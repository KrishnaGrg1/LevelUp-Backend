import Joi from 'joi';

const aiValidation = {
	chat: {
		body: Joi.object({
			prompt: Joi.string().min(1).max(4000).required(),
		}),
	},
	generateTrigger: {
		body: Joi.object({}).unknown(false),
	},
	completeQuest: {
		body: Joi.object({
			questId: Joi.string().required(),
		}),
	},
	questId: {
		params: Joi.object({
			questId: Joi.string().required(),
		}),
	},
	completedQuests: {
		query: Joi.object({
			page: Joi.number().integer().min(1).optional(),
			limit: Joi.number().integer().min(1).max(100).optional(),
			type: Joi.string().valid('Daily', 'Weekly').optional(),
		}),
	},
};

export default aiValidation;
