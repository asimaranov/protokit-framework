import "reflect-metadata";
import { UInt112 } from "@proto-kit/common";
import { container } from "tsyringe";
import { RuntimeMethodExecutionContext } from "@proto-kit/protocol";
import { beforeEach } from "@jest/globals";
import bigintsqrt from "bigint-isqrt";

describe("uint112", () => {
  const executionContext = container.resolve(RuntimeMethodExecutionContext);

  beforeEach(() => {
    executionContext.clear();
    executionContext.setup({} as any);
  });

  it("should initialize correctly", () => {
    expect.assertions(2);

    const uint = UInt112.from(1);

    expect(uint.value.toBigInt()).toBe(1n);
    expect(executionContext.result.status.toBoolean()).toBe(true);
  });

  it("should mul correctly", () => {
    expect.assertions(2);

    const uint = UInt112.from(101);

    expect(uint.mul(987654).toBigInt()).toBe(101n * 987654n);
    expect(executionContext.result.status.toBoolean()).toBe(true);
  });

  it("should fail for init with higher value", () => {
    expect.assertions(1);

    // We throw on constant inits
    expect(() => {
      UInt112.from(2n ** 128n);
    }).toThrow(/.*/u);
  });

  it("should fail for overflow addition", () => {
    expect.assertions(1);

    const uint = UInt112.from(2n ** 111n + 1n);

    uint.add(uint.value.toBigInt());

    expect(executionContext.result.status.toBoolean()).toBe(false);
  });

  it("should fail for overflow multiplication", () => {
    expect.assertions(1);

    const uint = UInt112.from(2n ** 110n);

    uint.mul(uint.value.toBigInt());

    expect(executionContext.result.status.toBoolean()).toBe(false);
  });

  it.each([5n, 0n, 101n, 2n ** 112n - 1n])(
    "should provide correct sqrt",
    (input) => {
      const uint = UInt112.from(input);

      const { sqrt, rest } = uint.sqrtMod();

      expect(sqrt.toBigInt()).toBe(bigintsqrt(input));
      expect(rest.toBigInt()).toBe(input - bigintsqrt(input) ** 2n);
    }
  );
});