import { ObjectId } from "mongodb";
import { z } from "zod";
// === Schemas ===
export const classSchema = z.object({
  className: z.string(),
  subclassName: z.string().optional(),
  level: z.number().optional(),
  primaryClass: z.boolean().optional(),
});
export const spellSchema = z.object({
  name: z.string(),
  description: z.string(),
  level: z.number(),
  castingTime: z.string(),
  range: z.string(),
});

export const playerSchema = z.object({
  hp: z.number(),
  currentHp: z.number(),
  name: z.string(),
  status: z.string().optional(),
  resistances: z.array(z.string()).optional(),
  immunities: z.array(z.string()).optional(),
  vulnerabilities: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  size: z.string().optional(),
  class: z.array(classSchema).optional(),
  level: z.number().optional(),
  species: z.string().optional(),
  spells: z.array(spellSchema).optional(),
  inventory: z.array(z.string()).optional(),
  spellSlots: z.object({
    level1: z.number().optional(),
    level2: z.number().optional(),
    level3: z.number().optional(),
    level4: z.number().optional(),
    level5: z.number().optional(),
    level6: z.number().optional(),
    level7: z.number().optional(),
    level8: z.number().optional(),
    level9: z.number().optional(),
  }).optional(),
  background: z.string().optional(),
  alignment: z.string().optional(),
  feats: z.array(z.string()).optional(),
  speed: z.number().optional(),
  canFly: z.boolean().optional(),
  canSwim: z.boolean().optional(),
  actions: z.array(z.string()).optional(),
  canAct: z.boolean().optional(),
  canMove: z.boolean().optional(),
  canCastVerbal: z.boolean().optional(),
  canCastSomatic: z.boolean().optional(),
  UsedMovement: z.boolean().optional(),
  UsedAction: z.boolean().optional(),
  UsedBonusAction: z.boolean().optional(),


});

export const monsterSchema = z.object({
  type: z.string(),
  hp: z.number(),
  currentHp: z.number(),
  status: z.string().optional(),
  class: classSchema.optional(),
  resistances: z.array(z.string()).optional(),
  immunities: z.array(z.string()).optional(),
  vulnerabilities: z.array(z.string()).optional(),
  size: z.string().optional(),
  challengeRating: z.number().optional(),
  spells: z.array(spellSchema).optional(),
  actions: z.array(z.string()).optional(),
  canAct: z.boolean().optional(),
  canMove: z.boolean().optional(),
  canCastVerbal: z.boolean().optional(),
  canCastSomatic: z.boolean().optional(),
  UsedMovement: z.boolean().optional(),
  UsedAction: z.boolean().optional(),
  UsedBonusAction: z.boolean().optional(),
  canFly: z.boolean().optional(),
  canSwim: z.boolean().optional(),
  
});


export const fightSchema = z.object({
  round: z.number().optional(),
  currentTurn: z.string().optional(),
  initiativeOrder: z.array(z.string()),
  players: z.array(z.string()).optional(), // Array of player IDs
  monsters: z.array(z.string()).optional(), // Array of monster IDs
});
export type PlayerObject = z.infer<typeof playerSchema>;
export type MonsterObject = z.infer<typeof monsterSchema>;
export type FightObject = z.infer<typeof fightSchema>;
export type ClassObject = z.infer<typeof classSchema>;
export type SpellObject = z.infer<typeof spellSchema>;





// export interface PlayerObject {
//     _id : ObjectId | string;
//     hp: number;
//     name: string;
//     id?:number;
//     status?:string;
//     class?: string;
//     level?: number;
//     species?: string;
//     spells?: string[];
//     inventory?: string[];
//     spellSlots?: {
//         level1?: number;
//         level2?: number;
//         level3?: number;
//         level4?: number;
//         level5?: number;
//         level6?: number;
//         level7?: number;
//         level8?: number;
//         level9?: number;
//     };
    

// }


// export interface MonsterObject {
//   _id : ObjectId | string;
//      hp: number;
//   type: string;
//   status?: string;
//   key: string;
// }


