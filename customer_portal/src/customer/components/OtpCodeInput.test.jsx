import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import OtpCodeInput from "./OtpCodeInput";

function OtpHarness() {
  const [value, setValue] = useState("");

  return (
    <>
      <OtpCodeInput id="test-code" label="Verification code" value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}

describe("OtpCodeInput", () => {
  it("renders six separate digit boxes and distributes pasted codes", () => {
    render(<OtpHarness />);

    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(6);
    fireEvent.paste(boxes[0], {
      clipboardData: { getData: () => "123456" },
    });

    expect(boxes.map((box) => box.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(screen.getByText("123456")).toBeInTheDocument();
  });

  it("keeps typed digits in their individual boxes and supports external resets", () => {
    const { rerender } = render(<OtpHarness />);

    const boxes = screen.getAllByRole("textbox");
    fireEvent.change(boxes[0], { target: { value: "1" } });
    fireEvent.change(boxes[1], { target: { value: "2" } });

    expect(boxes[0]).toHaveValue("1");
    expect(boxes[1]).toHaveValue("2");
    expect(screen.getByText("12")).toBeInTheDocument();

    rerender(
      <OtpCodeInput id="test-code" label="Verification code" value="" onChange={() => {}} />,
    );
    expect(screen.getAllByRole("textbox").every((box) => box.value === "")).toBe(true);
  });
});
