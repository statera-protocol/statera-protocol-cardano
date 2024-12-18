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

const scriptAddr = serializePlutusScript(
    { code: parameterizedScript, version: 'V3' },
    undefined,
    0
).address;

export {
    parameterizedScript,
    scriptAddr
}
