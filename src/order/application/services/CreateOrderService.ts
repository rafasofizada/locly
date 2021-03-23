import { EventEmitter2 } from '@nestjs/event-emitter';

import { OrderRepository } from '../port/OrderRepository';
import { CustomerRepository } from '../port/CustomerRepository';
import {
  ShipmentCostCalculator,
  ShipmentCostRequest,
} from '../port/ShipmentCostCalculator';

import {
  CreateOrderRequest,
  CreateOrderUseCase,
} from '../../domain/use-case/CreateOrderUseCase';

import { Order } from '../../domain/entity/Order';
import { Customer } from '../../domain/entity/Customer';
import { Injectable } from '@nestjs/common';
import { InjectClient } from 'nest-mongodb';
import { ClientSession, MongoClient } from 'mongodb';
import { EntityId } from '../../../common/domain/EntityId';
import { Country } from '../../domain/data/Country';
import { Item } from '../../domain/entity/Item';
import { withTransaction } from '../../../common/utils';
import { Exception } from '../../../common/error-handling/Exception';
import { Code } from '../../../common/error-handling/Code';
import { HostMatcher } from '../port/HostMatcher';

@Injectable()
export class CreateOrder implements CreateOrderUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly orderRepository: OrderRepository,
    private readonly hostMatcher: HostMatcher,
    private readonly shipmentCostCalculator: ShipmentCostCalculator,
    // TODO: More general EventEmitter class, wrapper around eventEmitter
    private readonly eventEmitter: EventEmitter2,
    @InjectClient() private readonly mongoClient: MongoClient,
  ) {}

  // Input validation in Controllers (/infrastructure)
  async execute({
    customerId,
    originCountry,
    items,
  }: CreateOrderRequest): Promise<Order> {
    const session = this.mongoClient.startSession();

    // TODO: Helper function instead of assigning a let variable in try block: https://jira.mongodb.org/browse/NODE-2014
    const order: Order = await withTransaction(
      () =>
        this.createDraftOrderAndPersist(
          customerId,
          originCountry,
          items,
          session,
        ),
      session,
    );

    // Serialization in Controllers (/infrastructure)
    return order;
  }

  private async createDraftOrderAndPersist(
    customerId: EntityId,
    originCountry: Country,
    items: Item[],
    session: ClientSession,
  ): Promise<Order> {
    const customer: Customer = await this.customerRepository.findCustomer(
      customerId,
      session,
    );

    const order = new Order({
      customerId: customer.id,
      originCountry,
      items,
      destination: customer.selectedAddress,
    });

    await this.checkServiceAvailability(order);

    await order.draft((costRequest: ShipmentCostRequest) =>
      this.shipmentCostCalculator.getRate(costRequest),
    );
    customer.acceptOrder(order);

    // Thanks to transactions, I can run these two concurrently
    await Promise.all([
      // TODO(GLOBAL): Add rollback for order.draft
      this.orderRepository.addOrder(order, session),
      this.customerRepository.addOrderToCustomer(customer, order, session),
    ]);

    // TODO: Wrapper around eventEmitter
    // TODO(?): Event emitting decorator
    this.eventEmitter.emitAsync('order.drafted', order);

    return order;
  }

  private async checkServiceAvailability({
    originCountry,
    destination: { country: destinationCountry },
  }: Order): Promise<void> {
    const isServiceAvailable: boolean = await this.hostMatcher.checkServiceAvailability(
      originCountry,
      destinationCountry,
    );

    if (!isServiceAvailable) {
      // TODO: Wrapper around eventEmitter
      // TODO(?): Event emitting decorator
      this.eventEmitter.emit('order.rejected.service_availability');

      throw new Exception(
        Code.INTERNAL_ERROR,
        `Service not available in origin ${originCountry} or destination ${destinationCountry}`,
      );
    }
  }
}
