const PromptSuggestionsButton = ({onClick, text}: {onClick: () => void, text: string}) => {
    return (
        <button className="prompt-suggestions-button" onClick={onClick}>
            Suggest a Prompt
            {text}
        </button>
    );
};

export default PromptSuggestionsButton;