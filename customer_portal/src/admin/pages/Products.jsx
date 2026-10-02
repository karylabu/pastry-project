import React from "react";
import StaffProducts from "../operations/pages/Products";

export default function Products(props) {
  return <StaffProducts allowCatalogManagement={true} {...props} />;
}
