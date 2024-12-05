import { applyParamsToScript, builtinByteString, serializePlutusScript } from "@meshsdk/core";
import { blueprint, wallet1VK } from "../setup.js";

// Protocol Parameter Validator
const ProtocolParameterValidator = blueprint.validators.filter((val) => val.title.includes('protocol_parameter.spend'));
if (!ProtocolParameterValidator) {
    throw new Error('Protocol Parameter Validator not found!');
}

const parameterizedScript = applyParamsToScript(
    ProtocolParameterValidator[0].compiledCode,
    [builtinByteString(wallet1VK)],
    "JSON"
);

// const parameterizedScript = applyParamsToScript(
//     "5901050101003232323232323223225333004323232323253330093370e900118051baa00113232533300b3370e900018061baa301030110021533300b3370e900018061baa32323300100137586004601e6ea8020894ccc044004530103d87a80001323253330103375e600a60246ea80080184cdd2a40006602800497ae01330040040013015002301300123011001132330010013758602260246024602460246024602460246024601c6ea801c894ccc040004528099299980719b8f375c602600401829444cc00c00c004c04c0045858c03c004c02cdd50008b1806980700118060009806001180500098031baa00114984d958dd7000ab9a5573aaae7955cfaba05742ae89",
//     [builtinByteString(wallet1VK)],
//     "JSON"
// );

const scriptAddr = serializePlutusScript(
    { code: parameterizedScript, version: 'V3' },
    undefined,
    0
).address;

export {
    parameterizedScript,
    scriptAddr
}
