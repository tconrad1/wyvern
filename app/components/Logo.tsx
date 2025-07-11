import React from "react";
import Image from "next/image";
import tarot from "../assets/hermit.png";
import wyvern from "../assets/wyvernLogo.jpg";


// Accept `name` as a prop
function Logo({ name = "tarot" }) {
  const selectedImage = name === "tarot" ? tarot : wyvern;

  return (
    <div className="logo-container">
      <Image
        src={selectedImage}
        alt="Logo"
        width={120}
        height={120}
        className="logo-image"
      />
    </div>
  );
}

export default Logo;
