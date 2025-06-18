import React from "react";

const Bubble = ({message} : {message: {content: React.ReactNode, role: string}}) => {
    const {content, role} = message;
    return (
       <div className={`bubble ${role}`}>
        {content}
       </div>

    )

}

export default Bubble;