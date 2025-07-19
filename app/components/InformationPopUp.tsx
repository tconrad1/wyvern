import React from 'react';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';
import styles from './Button.module.css';

function InformationPopupWithLibrary({ message }) {
  return (
    <Popup trigger={<button className={`info-button ${styles.button}`}>Show Info</button>} position="right top">
      <div className="info-popup-message">{message}</div>
    </Popup>
  );
}

export default InformationPopupWithLibrary;