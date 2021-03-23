import { IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { EntityProps } from '../../../common/domain/Entity';
import { EntityId } from '../../../common/domain/EntityId';
import { EntityIdToStringId } from '../../../common/types';
import { Serializable } from '../../../common/domain/Serializable';
import { Identifiable } from '../../../common/domain/Identifiable';

import { Address, AddressProps } from './Address';
import { Order } from './Order';
import { Exception } from '../../../common/error-handling/Exception';
import { Code } from '../../../common/error-handling/Code';
import { TransformEntityIdArrayToStringArray } from '../../../common/utils';

export class HostProps extends EntityProps {
  @ValidateNested()
  @Type(() => Address)
  address: Address;

  @IsBoolean()
  available: boolean;

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => EntityId)
  @TransformEntityIdArrayToStringArray()
  orderIds: EntityId[];
}

export type HostPropsPlain = Omit<
  EntityIdToStringId<Required<HostProps>>,
  'address' | 'orderIds'
> & {
  address: AddressProps;
  orderIds: string[];
};

export class Host extends Identifiable(
  Serializable<HostPropsPlain, typeof HostProps>(HostProps),
) {
  constructor(
    {
      id = new EntityId(),
      address,
      orderIds,
      available,
    }: HostProps = new HostProps(), // default value is needed for class-validator plainToClass. Refer to: Order.ts
  ) {
    super();

    this.id = id;
    this.address = address;
    this.orderIds = orderIds;
    this.available = available;
  }

  async acceptOrder(order: Order) {
    this.orderIds.push(order.id);
  }
}
