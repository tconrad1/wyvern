import React from "react";
import Image from "next/image";
import tarot from "../assets/hermit.png";
import wyvern from "../assets/wyvernLogo.jpg";
import styles from "./Logo.module.css";


// Accept `name` as a prop
function Logo({ name = "tarot" }) {
  const selectedImage = name === "tarot" ? tarot : wyvern;

  return (
    <div className={styles.logoContainer}>
      <Image
        src={selectedImage}
        alt="Logo"
        width={120}
        height={120}
        className={styles.logoImage}
      />
    </div>
  );
}

export default Logo;
