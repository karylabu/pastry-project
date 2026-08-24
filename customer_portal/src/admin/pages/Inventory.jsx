import React from "react";
import StaffIngredients from "../../staff/pages/Ingredients";

export default function Inventory() {
  return (
    <StaffIngredients
      showNavbar={false}
      pageContainerClassName="lg:pl-[260px] pt-[72px]"
      contentClassName="max-w-[1400px] mx-auto px-6 md:px-10 py-8"
    />
  );
}
