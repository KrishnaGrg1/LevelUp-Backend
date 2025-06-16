import Joi from 'joi'

const authValidation = {
    register: {
        body: Joi.object().keys({
            UserName: Joi.string().min(2).max(150).required().messages({
                "string.empty": "Username is required",
                "string.min": "Username must contain altleast 2 characters long",
                "string.max": "Username mustnot exceed 150 characters long"
            }),
            email: Joi.string().email().required().messages({
                "string.empty": "Username is required",
                "string.email": "Username must be valid email address"
            }),
            password: Joi.string().min(8).max(50).required().messages({
                "string.empty": "Password is required",
                "string.min": "Passsword must be at least 8 character",
                "string.max": "Password must not exceed 50 characters"
            })
        })
    },
    login: {
        body: Joi.object().keys({
            email: Joi.string().email().required().messages({
                "string.empty": "Username is required",
                "string.email": "Username must be valid email address"
            }),
            password: Joi.string().min(8).max(50).required().messages({
                "string.base": "Password must be string",
                "string.empty": "Password is required",
                "string.min": "Password must be atleast 8 characters long",
                "string.max": "Password mustnot exceed 50 characters long",
                "any.required": "Password is required"
            })
        })
    }
}

export default authValidation