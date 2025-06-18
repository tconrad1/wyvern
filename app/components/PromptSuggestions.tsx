import React from "react";
import PromptSuggestionsButton from "./PromptSuggestionsButton";
const PromptSuggestions = ({onPromptClick}: {onPromptClick: (prompt: string) => void}) => {
    const prompts = [
        "Ask a rules question",
        "get advice on lore",
        "DM for me (in the works still)"

    ]

    return (
        <div className="prompt-suggestion-row">
            {prompts.map((prompt, index) => (
                <PromptSuggestionsButton key={`prompt-suggestion-${index}`}   onClick={() => onPromptClick(prompt)} text={prompt} />
            ))}
        </div>

    )
}

export default PromptSuggestions;