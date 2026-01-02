export function structToJson(structObj: any): any {
  if (!structObj || !structObj.fields) {
    return structObj;
  }

  const json: any = {};

  for (const key in structObj.fields) {
    const valueObj = structObj.fields[key];
    json[key] = valueToJson(valueObj);
  }

  return json;
}

function valueToJson(valueObj: any): any {
  if (!valueObj) return null;

  if ('stringValue' in valueObj) return valueObj.stringValue;
  if ('numberValue' in valueObj) return valueObj.numberValue;
  if ('boolValue' in valueObj) return valueObj.boolValue;
  
  if ('structValue' in valueObj) return structToJson(valueObj.structValue);
  
  if ('listValue' in valueObj && valueObj.listValue.values) {
    return valueObj.listValue.values.map((v: any) => valueToJson(v));
  }

  if ('nullValue' in valueObj) return null;

  return undefined;
}