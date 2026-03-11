import { describe, expect, it, vi } from "vitest";
import {
  __resetOrdersForTests,
  confirmSettlement,
  createOrder,
  getOrder,
  updateOrderStatus,
} from "../src/services/remittanceService";

vi.mock("../src/services/fxOracle", () => ({
  getUsdInrRate: vi.fn(async () => ({
    rate: 83.5,
    sources: ["mock"],
    cached: false,
  })),
}));

describe("remittanceService", () => {
  it("creates order and locks fx", async () => {
    __resetOrdersForTests();
    const order = await createOrder({
      sender: "5F3sa2TJAWMqDhXG6jhV4N8ko9j5wE7jN9nvn8hL7E5f9P6z",
      recipient: "recipient@upi",
      assetSymbol: "USDC",
      amountIn: 200,
      deliveryMode: "UPI_INSTANT",
    });

    expect(order.id.startsWith("0x")).toBe(true);
    expect(order.status).toBe("RATE_LOCKED");
    expect(order.fxRateLocked).toBe(83.5);
  });

  it("updates status and confirms settlement", async () => {
    __resetOrdersForTests();
    const order = await createOrder({
      sender: "5DAAnrj7VHTz5Vj2CeP8Ngr7m9yA8j8g8LiR5c6xj3n1tU4Q",
      recipient: "recipient@upi",
      assetSymbol: "USDT",
      amountIn: 100,
      deliveryMode: "UPI_INSTANT",
    });

    const progressed = updateOrderStatus(order.id, "SETTLEMENT_TRIGGERED", {
      type: "TEST",
      message: "ready",
    });
    expect(progressed?.status).toBe("SETTLEMENT_TRIGGERED");

    const completed = confirmSettlement(order.id, "HDFC123456789012");
    expect(completed?.status).toBe("COMPLETED");
    expect(getOrder(order.id)?.utrNumber).toBe("HDFC123456789012");
  });
});
