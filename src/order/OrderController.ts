import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import {
  IDraftOrder,
  DraftOrderRequest,
  DraftOrderPayload,
} from './application/DraftOrder/IDraftOrder';
import {
  ConfirmOrderRequest,
  IConfirmOrder,
  ConfirmOrderPayload,
  ConfirmOrderResult,
} from './application/ConfirmOrder/IConfirmOrder';
import {
  ReceiveItemResult,
  IReceiveItem,
  ReceiveItemRequest,
  ReceiveItemPayload,
} from './application/ReceiveItem/IReceiveItem';
import { DraftedOrder, Order } from './entity/Order';
import {
  IEditOrder,
  EditOrderRequest,
  EditOrderPayload,
} from './application/EditOrder/IEditOrder';
import {
  DeleteOrderPayload,
  DeleteOrderRequest,
  DeleteOrderResult,
  IDeleteOrder,
} from './application/DeleteOrder/IDeleteOrder';
import {
  AddItemPhotoPayload,
  AddItemPhotoRequest,
  IAddItemPhoto,
} from './application/AddItemPhoto/IAddItemPhoto';
import { Photo } from './persistence/OrderMongoMapper';
import {
  SubmitShipmentInfoRequest,
  SubmitShipmentInfoResult,
  ISubmitShipmentInfo,
  SubmitShipmentInfoPayload,
} from './application/SubmitShipmentInfo/ISubmitShipmentInfo';
import {
  IPayShipment,
  PayShipmentPayload,
  PayShipmentRequest,
  PayShipmentResult,
} from './application/PayShipment/IPayShipment';
import {
  AnyEntityIdentity,
  CustomerIdentity,
  VerifiedHostIdentity,
} from '../auth/infrastructure/IdentityDecorator';
import { isUUID, UUID } from '../common/domain';
import { Host } from '../host/entity/Host';
import { EntityType } from '../auth/entity/Token';
import { IGetOrder } from './application/GetOrder/IGetOrder';

@Controller('order')
export class OrderController {
  constructor(
    private readonly draftOrder: IDraftOrder,
    private readonly editOrder: IEditOrder,
    private readonly deleteOrder: IDeleteOrder,
    private readonly confirmOrder: IConfirmOrder,
    private readonly receiveItem: IReceiveItem,
    private readonly addItemPhoto: IAddItemPhoto,
    private readonly submitShipmentInfo: ISubmitShipmentInfo,
    private readonly payShipment: IPayShipment,
  ) {}

  @Post()
  async draftOrderHandler(
    @Body() unidDraftOrderRequest: DraftOrderRequest,
    @CustomerIdentity() customerId: UUID,
  ): Promise<DraftedOrder> {
    // TODO: Decorator for attaching identity id to request
    const draftOrderPayload: DraftOrderPayload = {
      ...unidDraftOrderRequest,
      customerId,
    };

    const draftOrder: DraftedOrder = await this.draftOrder.execute({
      port: draftOrderPayload,
    });

    return draftOrder;
  }

  @Patch()
  async editOrderHandler(
    @Body() unidEditOrderRequest: EditOrderRequest,
    @CustomerIdentity() customerId: UUID,
  ): Promise<DraftedOrder> {
    const editOrderPayload: EditOrderPayload = {
      ...unidEditOrderRequest,
      customerId,
    };

    const editedDraftOrder: DraftedOrder = await this.editOrder.execute({
      port: editOrderPayload,
    });

    return editedDraftOrder;
  }

  @Delete()
  async deleteOrderHandler(
    @Body() unidDeleteOrderRequest: DeleteOrderRequest,
    @CustomerIdentity() customerId: UUID,
  ): Promise<DeleteOrderResult> {
    const deleteOrderPayload: DeleteOrderPayload = {
      ...unidDeleteOrderRequest,
      customerId,
    };

    await this.deleteOrder.execute({ port: deleteOrderPayload });
  }

  @Post('confirm')
  async confirmOrderHandler(
    @Body() unidConfirmaOrderRequest: ConfirmOrderRequest,
    @CustomerIdentity() customerId: UUID,
  ): Promise<ConfirmOrderResult> {
    const confirmOrderPayload: ConfirmOrderPayload = {
      ...unidConfirmaOrderRequest,
      customerId,
    };

    const stripeCheckoutSession = await this.confirmOrder.execute({
      port: confirmOrderPayload,
    });

    return stripeCheckoutSession;
  }

  @Post('receiveItem')
  async receiveItemHandler(
    @Body() unidReceiveItemRequest: ReceiveItemRequest,
    @VerifiedHostIdentity() { id: hostId }: Host,
  ): Promise<ReceiveItemResult> {
    const receiveItemPayload: ReceiveItemPayload = {
      ...unidReceiveItemRequest,
      hostId,
    };

    const receivedDateResult = await this.receiveItem.execute({
      port: receiveItemPayload,
    });

    return receivedDateResult;
  }

  @Post('addItemPhotos')
  // file control/validation is done by MulterModule registration
  @UseInterceptors(FilesInterceptor('photos'))
  async addItemPhotoHandler(
    @Body() unidAddItemPhotoRequest: AddItemPhotoRequest,
    @UploadedFiles() photos: Photo[],
    @VerifiedHostIdentity() { id: hostId }: Host,
  ) {
    const addItemPhotoPayload: AddItemPhotoPayload = {
      ...unidAddItemPhotoRequest,
      hostId,
      photos,
    };

    const receivedDateResult = await this.addItemPhoto.execute({
      port: {
        ...addItemPhotoPayload,
      },
    });

    return receivedDateResult;
  }

  @Post('submitShipmentInfo')
  async submitShipmentInfoHandler(
    @Body() unidSubmitShipmentInfoRequest: SubmitShipmentInfoRequest,
    @VerifiedHostIdentity() { id: hostId }: Host,
  ): Promise<SubmitShipmentInfoResult> {
    const submitShipmentInfoPayload: SubmitShipmentInfoPayload = {
      ...unidSubmitShipmentInfoRequest,
      hostId,
    };

    await this.submitShipmentInfo.execute({ port: submitShipmentInfoPayload });
  }

  @Post('payShipment')
  async payShipmentHandler(
    @Body() unidPayShipmentRequest: PayShipmentRequest,
    @CustomerIdentity() customerId: UUID,
  ): Promise<PayShipmentResult> {
    const payShipmentPayload: PayShipmentPayload = {
      ...unidPayShipmentRequest,
      customerId,
    };

    const stripeCheckoutSession = await this.payShipment.execute({
      port: payShipmentPayload,
    });

    return stripeCheckoutSession;
  }
}
