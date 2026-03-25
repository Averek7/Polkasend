"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const remittanceService_1 = require("../src/services/remittanceService");
vitest_1.vi.mock("../src/services/fxOracle", () => ({
    getUsdInrRate: vitest_1.vi.fn(async () => ({
        rate: 83.5,
        sources: ["mock"],
        cached: false,
    })),
}));
(0, vitest_1.describe)("remittanceService", () => {
    (0, vitest_1.it)("creates order and locks fx", async () => {
        (0, remittanceService_1.__resetOrdersForTests)();
        const order = await (0, remittanceService_1.createOrder)({
            sender: "5F3sa2TJAWMqDhXG6jhV4N8ko9j5wE7jN9nvn8hL7E5f9P6z",
            recipient: "recipient@upi",
            assetSymbol: "USDC",
            amountIn: 200,
            deliveryMode: "UPI_INSTANT",
        });
        (0, vitest_1.expect)(order.id.startsWith("0x")).toBe(true);
        (0, vitest_1.expect)(order.status).toBe("RATE_LOCKED");
        (0, vitest_1.expect)(order.fxRateLocked).toBe(83.5);
    });
    (0, vitest_1.it)("updates status and confirms settlement", async () => {
        (0, remittanceService_1.__resetOrdersForTests)();
        const order = await (0, remittanceService_1.createOrder)({
            sender: "5DAAnrj7VHTz5Vj2CeP8Ngr7m9yA8j8g8LiR5c6xj3n1tU4Q",
            recipient: "recipient@upi",
            assetSymbol: "USDT",
            amountIn: 100,
            deliveryMode: "UPI_INSTANT",
        });
        const progressed = (0, remittanceService_1.updateOrderStatus)(order.id, "SETTLEMENT_TRIGGERED", {
            type: "TEST",
            message: "ready",
        });
        (0, vitest_1.expect)(progressed?.status).toBe("SETTLEMENT_TRIGGERED");
        const completed = (0, remittanceService_1.confirmSettlement)(order.id, "HDFC123456789012");
        (0, vitest_1.expect)(completed?.status).toBe("COMPLETED");
        (0, vitest_1.expect)((0, remittanceService_1.getOrder)(order.id)?.utrNumber).toBe("HDFC123456789012");
    });
});
