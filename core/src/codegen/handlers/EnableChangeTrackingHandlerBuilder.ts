import { EnableChangeTrackingObjectHandler } from "./enableChangeTracking/EnableChangeTrackingObjectHandler";
import { EnableChangeTrackingArrayHandler } from "./enableChangeTracking/EnableChangeTrackingArrayHandler";
import { EnableChangeTrackingPrimitiveValueHandler } from "./enableChangeTracking/EnableChangeTrackingPrimitiveValueHandler";

/// Purpose:
export class EnableChangeTrackingHandlerBuilder {

    build() {
        const handler = new EnableChangeTrackingObjectHandler();
        handler.setNext(new EnableChangeTrackingArrayHandler()).setNext(new EnableChangeTrackingPrimitiveValueHandler());

        return handler;
    }
}