import { ObjectId } from "mongodb";

export interface PlayerObject {
    _id : ObjectId | string;
    hp: number;
    name: string;
    id?:number;
    status?:string;
    class?: string;
    level?: number;
    species?: string;
    spells?: string[];
    inventory?: string[];
    spellSlots?: {
        level1?: number;
        level2?: number;
        level3?: number;
        level4?: number;
        level5?: number;
        level6?: number;
        level7?: number;
        level8?: number;
        level9?: number;
    };
    

}


export interface MonsterObject {
  _id : ObjectId | string;
     hp: number;
  type: string;
  status?: string;
  key: string;
}


