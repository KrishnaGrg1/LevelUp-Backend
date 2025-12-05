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
};

export default aiValidation;
