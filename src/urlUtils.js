// urlUtils.js - Utilities for handling URL parameters in donor-facing pages

/**
 * Extract URL search parameters and validate required fields
 * @param {string} search - window.location.search
 * @param {string[]} required - Array of required parameter names
 * @returns {Object} - { params: {}, errors: [], isValid: boolean }
 */
export const extractUrlParams = (search, required = []) => {
    const urlParams = new URLSearchParams(search);
    const params = {};
    const errors = [];
    
    // Extract all parameters
    for (const [key, value] of urlParams) {
      params[key] = value;
    }
    
    // Check for required parameters
    required.forEach(param => {
      if (!params[param] || params[param].trim() === '') {
        errors.push(`Missing required parameter: ${param}`);
      }
    });
    
    return {
      params,
      errors,
      isValid: errors.length === 0
    };
  };
  
  /**
   * Extract and validate pledge page parameters
   * @param {string} search - window.location.search
   * @returns {Object} - { campaignId, campusId, errors, isValid }
   */
  export const extractPledgeParams = (search) => {
    const { params, errors, isValid } = extractUrlParams(search, ['campaign', 'campus']);
    
    return {
      campaignId: params.campaign,
      campusId: params.campus,
      errors,
      isValid
    };
  };
  
  /**
   * Extract and validate giving page parameters
   * @param {string} search - window.location.search
   * @returns {Object} - { campaignId, campusId, listingId, errors, isValid }
   */
  export const extractGivingParams = (search) => {
    const { params, errors, isValid } = extractUrlParams(search, ['campaign', 'campus', 'listing']);
    
    return {
      campaignId: params.campaign,
      campusId: params.campus,
      listingId: params.listing,
      errors,
      isValid
    };
  };
  
  /**
   * Create error messages for missing or invalid parameters
   * @param {string[]} errors - Array of error messages
   * @returns {string} - Formatted error message for display
   */
  export const formatParamErrors = (errors) => {
    if (errors.length === 0) return '';
    
    return `Invalid link: ${errors.join(', ')}. Please contact the organization for a valid donation link.`;
  };
  
  /**
   * Validate that IDs look like Airtable record IDs
   * @param {string} id - ID to validate
   * @returns {boolean} - True if looks like valid Airtable record ID
   */
  export const isValidAirtableId = (id) => {
    if (!id || typeof id !== 'string') return false;
    
    // Airtable record IDs are typically 17-18 characters, start with 'rec'
    return /^rec[a-zA-Z0-9]{14,15}$/.test(id);
  };
  
  /**
   * Validate all required IDs for pledge page
   * @param {string} campaignId 
   * @param {string} campusId 
   * @returns {Object} - { isValid, errors }
   */
  export const validatePledgeIds = (campaignId, campusId) => {
    const errors = [];
    
    if (!isValidAirtableId(campaignId)) {
      errors.push('Invalid campaign ID format');
    }
    
    if (!isValidAirtableId(campusId)) {
      errors.push('Invalid campus ID format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  /**
   * Validate all required IDs for giving page
   * @param {string} campaignId 
   * @param {string} campusId 
   * @param {string} listingId 
   * @returns {Object} - { isValid, errors }
   */
  export const validateGivingIds = (campaignId, campusId, listingId) => {
    const errors = [];
    
    if (!isValidAirtableId(campaignId)) {
      errors.push('Invalid campaign ID format');
    }
    
    if (!isValidAirtableId(campusId)) {
      errors.push('Invalid campus ID format');
    }
    
    if (!isValidAirtableId(listingId)) {
      errors.push('Invalid listing ID format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };