import { InferType, s } from "@routier/core/schema";

const orderSchema = s.define("orders", {
    id: s.string().key().identity(),
    customerId: s.string(),
    items: s.array(s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
    })),
    status: s.string("pending", "processing", "shipped", "delivered"),
    total: s.number(),
    createdAt: s.date().default(() => new Date()),
}).compile();

type Order = InferType<typeof orderSchema>;

// API response type safety
interface ApiResponse<T> {
    data: T;
    success: boolean;
    message: string;
}

type OrderResponse = ApiResponse<Order>;
type OrdersResponse = ApiResponse<Order[]>;

// Type-safe API functions
async function getOrder(id: string): Promise<OrderResponse> {
    // Implementation would fetch from API
    return {
        data: {
            id,
            customerId: "customer-123",
            items: [
                { productId: "prod-1", quantity: 2, price: 29.99 }
            ],
            status: "pending",
            total: 59.98,
            createdAt: new Date(),
        },
        success: true,
        message: "Order retrieved successfully",
    };
}

async function getOrders(): Promise<OrdersResponse> {
    // Implementation would fetch from API
    return {
        data: [],
        success: true,
        message: "Orders retrieved successfully",
    };
}

// Type-safe response handling
async function processOrderResponse() {
    const response = await getOrder("order-123");

    if (response.success) {
        const order = response.data; // TypeScript knows this is Order type

        // Full type safety on order properties
        console.log(`Order ${order.id} status: ${order.status}`);
        console.log(`Total: $${order.total}`);
        console.log(`Items: ${order.items.length}`);

        // TypeScript knows items structure
        order.items.forEach(item => {
            console.log(`${item.productId}: ${item.quantity} x $${item.price}`);
        });
    }
}
