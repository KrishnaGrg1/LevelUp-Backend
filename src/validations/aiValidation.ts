import Joi from 'joi';

const aiValidation = {
	chat: {
		body: Joi.object({
			prompt: Joi.string().min(1).max(4000).required(),
		}),
	},
	generate: {
		body: Joi.object({
			goals: Joi.array().items(Joi.string().min(2).max(200)).min(1).required(),
			difficulty: Joi.string().valid('Beginner', 'Intermediate', 'Advanced').required(),
			count: Joi.number().integer().min(1).max(20).default(3),
			level: Joi.number().integer().min(1).max(100).optional(),
			status: Joi.string().valid('Beginner', 'Intermediate', 'Advanced').optional(),
			xp: Joi.number().integer().min(0).max(100000).optional(),
			type: Joi.string().valid('daily', 'extra').optional(),
		}),
	},
};

export default aiValidation;
