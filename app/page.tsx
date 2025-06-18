"use client" 
import Image from "next/image"
import wyvernLogo from "./assets/wyvernLogo.jpg"
import {useChat } from "ai/react"

import {Message} from "ai"
import Bubble from "./components/Bubble"
import LoadingBubble from "./components/loading"
import PromptSuggestions from "./components/PromptSuggestions"


const Home = () => {
    const {append, isLoading, messages, input, handleInputChange, handleSubmit} = useChat();

    const noMessages = !messages || messages.length === 0;
    

    const handlePrompt = (prompt: string) => {
        // This function will handle the prompt suggestions
        const msg : Message = {
            id: crypto.randomUUID(),
            content: prompt,
            role: "user",
        }
        append(msg);
    }




    return (
        <main>
            
            <Image src={wyvernLogo} width="250" alt="Wyvern Logo" />

            <section className={noMessages ? "" : "populated"}>
                {noMessages ? (
                    <>
                        <p className="starter-text"> Welcome to Wyvern DM </p>
                        <br />
                        /* Potential Suggestions could be placed here */
                        <PromptSuggestions onPromptClick={handlePrompt}/>
                    </>

            ) :
            (
                <>
                    {messages.map((message, index) => <Bubble key={`message-${index}`} message={message} />)}
                    {/* previous messages and feed back here */}

           {isLoading && <LoadingBubble/>}
            </>
            
        )

            }
        

            </section>
            <form onSubmit ={handleSubmit}>

            <input className="question-box" onChange={handleInputChange} value={input} placeholder="Enter message here"/>
           
           
            <input type="submit"/>
            
            
        </form>

        </main>

    ) 
}


export default Home;