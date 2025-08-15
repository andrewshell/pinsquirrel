// Domain validation schemas
export * from './domain-schemas.js'

// Pin validation schemas
export * from './pin-schemas.js'

// Legacy validation functions (keep for backward compatibility)
export * from './validators.js'

// New validation services (library-agnostic, preferred)
export {
  validateUsername,
  validatePassword,
  validateEmail,
  validateOptionalEmail,
  validateRegistration,
  validateLogin,
  validateEmailUpdate,
  validatePasswordChange,
  validateCreateUserData as validateNewUserData,
  validateUpdateUserData as validateUserDataUpdate,
  validateLoginCredentials as validateUserLogin,
} from './user-validation.js'

export {
  validateUrl,
  validatePinTitle,
  validatePinDescription,
  validateTagName,
  validateTagNames,
  validatePinCreation,
  validateCreatePinData as validateNewPinData,
  validateUpdatePinData as validatePinDataUpdate,
  validateCreateTagData as validateNewTagData,
  validateUpdateTagData as validateTagDataUpdate,
  validateIdParam,
  validatePagination,
} from './pin-validation.js'

// New validation result types (preferred over legacy ones)
export type {
  ValidationResult as GenericValidationResult,
  ValidationSuccess as GenericValidationSuccess,
  ValidationError as GenericValidationError,
  FieldErrors,
} from './types.js'

export {
  createSuccessResult,
  createErrorResult,
  createFieldError,
  createFormError,
} from './types.js'
