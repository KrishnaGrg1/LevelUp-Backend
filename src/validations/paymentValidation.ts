import Joi from 'joi';

const paymentValidation = {
  addpayment: {
    body: Joi.object().keys({
      paymentMethod: Joi.string().valid('khalti').required(),
      planid: Joi.string().hex().length(24).required(),
      // transactionUuid: Joi.string().uuid().required()
    }),
  },
  handlepayment: {
    query: Joi.object().keys({
      encodedData: Joi.string().required(),
    }),
  },
};

export default paymentValidation;
