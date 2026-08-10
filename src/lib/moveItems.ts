/**
 * Move-in / Move-out checklist items — ported 1:1 from Apps Script MoveInOut.gs MOVE_ITEMS.
 * Each item needs `min` photos (required items) and a Good/Broken condition flag.
 */
export interface MoveItem {
  key: string;
  label: string;
  max: number;
  required: boolean;
  min: number;
}

export const MOVE_ITEMS: MoveItem[] = [
  { key: "wholeRoom", label: "Whole Room Picture 整间房", max: 5, required: true, min: 1 },
  { key: "condition", label: "Condition of Room 房间状况", max: 3, required: true, min: 1 },
  { key: "bedframe", label: "Bedframe/Divan 床架", max: 2, required: true, min: 1 },
  { key: "mattress", label: "Mattress 床垫", max: 3, required: true, min: 1 },
  { key: "mattressCover", label: "Mattress Cover 床垫套", max: 2, required: true, min: 1 },
  { key: "studyTable", label: "Study Table 书桌 (有/无抽屉)", max: 3, required: true, min: 1 },
  { key: "sideTable", label: "Side Table 床头柜 (有才拍)", max: 2, required: false, min: 1 },
  { key: "dressingTable", label: "Dressing Table 梳妆台 (有才拍)", max: 2, required: false, min: 1 },
  { key: "curtain", label: "Curtain 窗帘", max: 2, required: true, min: 1 },
  { key: "wardrobe", label: "Wardrobe 衣柜 (正/侧/内 至少3张)", max: 5, required: true, min: 3 },
  { key: "chair", label: "Chair 椅子", max: 2, required: true, min: 1 },
  { key: "rubbishBin", label: "Rubbish Bin 垃圾桶", max: 2, required: true, min: 1 },
  { key: "aircond", label: "Aircond 冷气", max: 2, required: true, min: 1 },
  { key: "aircondRemote", label: "Aircond Remote 冷气遥控", max: 1, required: true, min: 1 },
  { key: "fan", label: "Ceiling/Wall Fan 风扇", max: 2, required: true, min: 1 },
  { key: "fanRemote", label: "Fan Remote 风扇遥控 (有才拍)", max: 1, required: false, min: 1 },
  { key: "accessCard", label: "Access Card 门卡 (正反面)", max: 3, required: true, min: 1 },
  { key: "roomKeys", label: "Room Keys 房间钥匙", max: 3, required: true, min: 1 },
  { key: "waterHeater", label: "Water Heater 热水器 (有才拍)", max: 2, required: false, min: 1 },
  { key: "parkingLot", label: "Parking Lot No. 车位号 (有才拍)", max: 2, required: false, min: 1 },
  { key: "meterReading", label: "Starting Electricity Meter Reading 电表读数", max: 2, required: true, min: 1 },
  { key: "others", label: "Others 其他物品 (选填)", max: 5, required: false, min: 1 },
  { key: "damages", label: "Damages/Scratches 损坏刮痕 (选填)", max: 5, required: false, min: 1 },
];
