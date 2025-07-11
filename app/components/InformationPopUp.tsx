import React from 'react';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

function InformationPopupWithLibrary({ message }) {
  return (
    <Popup trigger={<button>Show Info</button>} position="right top">
      <div>{message}</div>
    </Popup>
  );
}

export default InformationPopupWithLibrary;