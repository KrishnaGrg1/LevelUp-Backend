import Joi from 'joi';

const adminValidation = {
  /* =========================
   * USER
   * ========================= */

  updateDetails: {
    body: Joi.object().keys({
      UserName: Joi.string().min(2).max(150).optional().messages({
        'string.empty': 'UserName is required',
        'string.min': 'UserName must contain altleast 2 characters long',
        'string.max': 'UserName mustnot exceed 150 characters long',
      }),
      email: Joi.string().email().optional().messages({
        'string.empty': 'Username is required',
        'string.email': 'Username must be valid email address',
      }),
      level: Joi.number().integer().min(0).optional().messages({
        'number.base': 'Level must be a number',
        'number.integer': 'Level must be an integer',
        'number.min': 'Level cannot be negative',
      }),
      isVerified: Joi.boolean().optional().messages({
        'boolean.base': 'isVerified must be a boolean',
      }),
      xp: Joi.number().integer().min(0).optional().messages({
        'number.base': 'XP must be a number',
        'number.integer': 'XP must be an integer',
        'number.min': 'XP cannot be negative',
      }),
    }),
  },

  viewUserDetail: {
    params: Joi.object().keys({
      userId: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'User ID is required',
        'string.min': 'User ID must contain at least 2 characters long',
        'string.max': 'User ID must not exceed 150 characters long',
      }),
    }),
  },
  deleteUser: {
    body: Joi.object().keys({
      id: Joi.string().min(2).max(150).required().messages({
        'string.empty': 'User ID is required',
        'string.min': 'User ID must contain at least 2 characters long',
        'string.max': 'User ID must not exceed 150 characters long',
      }),
    }),
  },

  /* =========================
   * COMMUNITY
   * ========================= */

  getAllCommunities: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1).optional().messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
      }),
      limit: Joi.number().integer().min(1).optional().messages({
        'number.base': 'limit must be a number',
        'number.integer': 'limit must be an integer',
        'number.min': 'limit must be at least 1',
      }),

      sortBy: Joi.string().optional().messages({
        'string.base': 'Sort by must be a string',
        'any.only': 'Sort by must be one of: name, createdAt, memberCount',
      }),
      isPrivate: Joi.boolean().optional().messages({
        'boolean.base': 'isPrivate must be a boolean',
      }),
      search: Joi.string().optional().messages({
        'string.base': 'Search must be a string',
      }),
    }),
  },

  changeCommunityPrivacy: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required to update',
      }),
    }),
    body: Joi.object().keys({
      isPrivate: Joi.boolean().required().messages({
        'string.empty': 'Privacy setting is required',
        'any.required': 'Privacy setting is required',
      }),
    }),
  },

  changeCommunityCategory: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required to update',
      }),
    }),
    body: Joi.object().keys({
      category: Joi.string().required().messages({
        'string.empty': 'Category is required',
        'any.required': 'Category is required',
      }),
    }),
  },

  updateCommunityDetails: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required to update',
      }),
    }),

    body: Joi.object().keys({
      name: Joi.string().min(3).max(100).optional().messages({
        'string.empty': 'Community name is required',
        'string.min': 'Community name must contain at least 3 characters long',
        'string.max': 'Community name must not exceed 100 characters long',
      }),
      description: Joi.string().max(500).optional().messages({
        'string.max': 'Description must not exceed 500 characters long',
      }),
      ownerId: Joi.string().min(2).max(150).optional().messages({
        'string.empty': 'Owner ID is required',
        'string.min': 'Owner ID must contain at least 2 characters long',
        'string.max': 'Owner ID must not exceed 150 characters long',
      }),
    }),
  },

  removeCommunityMember: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required',
      }),
      memberId: Joi.string().required().messages({
        'string.empty': 'Member ID is required',
      }),
    }),
  },

  getAllCommunityMembers: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required',
      }),
    }),
  },

  /* =========================
   * CATEGORY
   * ========================= */

  addCategoryForCommunity: {
    body: Joi.object().keys({
      name: Joi.string().required().messages({
        'string.empty': 'Category name is required',
        'any.required': 'Category name is required',
      }),
    }),
  },

  editCategoryName: {
    params: Joi.object().keys({
      oldName: Joi.string().required().messages({
        'string.empty': 'Old category name is required',
        'any.required': 'Old category name is required',
      }),
    }),
    body: Joi.object().keys({
      name: Joi.string().required().messages({
        'string.empty': 'New category name is required',
        'any.required': 'New category name is required',
      }),
    }),
  },

  deleteCategory: {
    params: Joi.object().keys({
      categoryName: Joi.string().required().messages({
        'string.empty': 'Category name is required to delete',
      }),
    }),
  },

  deleteCommunity: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required to delete',
      }),
    }),
  },

  changeMemberRole: {
    params: Joi.object().keys({
      communityId: Joi.string().required().messages({
        'string.empty': 'Community ID is required',
      }),
      memberId: Joi.string().required().messages({
        'string.empty': 'Member ID is required',
      }),
    }),
    body: Joi.object().keys({
      role: Joi.string().valid('ADMIN', 'MEMBER').required().messages({
        'string.empty': 'Role is required',
        'any.only': 'Role must be either ADMIN or MEMBER',
        'any.required': 'Role is required',
      }),
    }),
  },

  /* =========================
   * TICKET
   * ========================= */

  updateTicket: {
    body: Joi.object().keys({
      status: Joi.string()
        .valid(
          'PENDING',
          'WORKING_ON',
          'TO_BE_DONE_LATER',
          'APPROVED',
          'REJECTED',
          'CANCELLED'
        )
        .required()
        .messages({
          'string.empty': 'Status is required',
          'any.only':
            'Status must be one of: OPEN, IN_PROGRESS, RESOLVED, CLOSED',
        }),
      priority: Joi.string()
        .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
        .optional()
        .messages({
          'string.empty': 'Priority is required',
          'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL',
        }),
      expectedDateOfCompletion: Joi.date().greater('now').required().messages({
        'any.required': 'Expected date of completion is required',
        'date.base': 'Expected date of completion must be a valid date',
        'date.greater': 'Expected date of completion must be in the future',
      }),
    }),
  },
};

export default adminValidation;
