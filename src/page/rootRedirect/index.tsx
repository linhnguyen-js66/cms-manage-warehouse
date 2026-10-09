import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hideLoading, showLoading } from "../loading";
import { decodeToken } from "@/utils";
import { Card } from "antd";


const RootRedirect = () => {
  const [filteredRoutes, setFilteredRoutes] = useState<any[]>([]);
  const navigate = useNavigate();
 

  useEffect(() => {
    showLoading();
    const timer = setTimeout(() => {
      navigate(filteredRoutes[0]?.element);
      hideLoading();
    }, 100);

    return () => {
      clearTimeout(timer);
      hideLoading();
    };
  }, [filteredRoutes]);

  return <Card className="h-[100vh]">

  </Card>;
};

export default RootRedirect;


