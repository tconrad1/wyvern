# DM Functionality Test Scenarios

## Current DM Capabilities

Based on the code analysis, the DM has these tools available:

### 1. Game State Management
- `updatePlayer({ id, data })` - Update player character data
- `updateMonster({ id, data })` - Update monster data  
- `updateFight({ id, data })` - Update combat encounter data
- `updatePlayerField({ id, field, value })` - Update specific player field
- `updateMonsterField({ id, field, value })` - Update specific monster field

### 2. Game Mechanics
- `rollDie({ sides, advantage, disadvantage, offset })` - Roll dice with modifiers
- `logCampaign({ narration, updates })` - Log campaign events

### 3. Prompt Types
- **DM Prompt**: For immersive storytelling and game actions
- **Rules Prompt**: For D&D rules questions (uses Weaviate data)

## Test Scenarios to Demonstrate

### Scenario 1: Inventory Management
**User**: "I want to pick up a rock and add it to my inventory"
**Expected DM Response**: 
- Describe the rock in the environment
- Use `updatePlayerField` to add rock to inventory
- Provide narrative response about the action

### Scenario 2: Combat Actions
**User**: "I attack the goblin with my sword"
**Expected DM Response**:
- Check if goblin exists in game state
- Use `rollDie` for attack roll and damage
- Use `updateMonsterField` to reduce goblin HP
- Provide narrative combat description

### Scenario 3: Exploration
**User**: "What do I see around me?"
**Expected DM Response**:
- Check current game state for entities
- Describe only what exists in the game state
- If nothing exists, say "The area appears clear"

### Scenario 4: Character Creation
**User**: "I am a level 3 rogue named Shadow"
**Expected DM Response**:
- Use `updatePlayer` to create character
- Welcome the player to the campaign
- Ask for additional character details

### Scenario 5: Rules Query (Should use Rules Prompt)
**User**: "What are the stats for a black bear?"
**Expected DM Response**:
- Should trigger rules prompt (contains "stats")
- Query Weaviate for bear information
- Provide accurate D&D rules information

## Current Issues to Address

1. **OpenRouter Rate Limiting**: API is experiencing high traffic
2. **Weaviate Vectorization**: `nearText` queries may not work without proper vectorization
3. **Game State Persistence**: Need to ensure actions properly update MongoDB

## Next Steps

1. Test each scenario when API is available
2. Verify tool function calls work correctly
3. Ensure game state updates persist across sessions
4. Test rules vs DM prompt selection accuracy 