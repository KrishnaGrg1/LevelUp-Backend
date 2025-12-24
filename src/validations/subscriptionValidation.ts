import Joi from 'joi';

const subscriptionValidation = {
  addSubscriptionPlan: {
    body: Joi.object().keys({
      planName: Joi.string().min(2).required(),
      durationMonth: Joi.number().valid(1, 3, 6, 12).required(),
      price: Joi.number().valid(1000, 2500, 5500, 10000).required(),
      features: Joi.array().items(Joi.string()).required(),
    }),
  },
};

export default subscriptionValidation;
