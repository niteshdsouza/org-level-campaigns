// PledgePage.jsx - Donor-facing pledge landing page (redesigned with steps)
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { extractPledgeParams, validatePledgeIds, formatParamErrors } from './urlUtils';
import { fetchCampaignById, fetchCampuses, createPledge, checkExistingPledge, createGift } from './airtable';
import './PledgePage.css';

function PledgePage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [campus, setCampus] = useState(null);
  
  // Step management - now includes gift confirmation step
  const [currentStep, setCurrentStep] = useState(1); // 1 = pledge details, 2 = personal details, 3 = confirm pledge, 4 = payment method, 5 = confirm gift
  const [duplicatePledgeError, setDuplicatePledgeError] = useState(null); // For handling duplicate pledges
  
  // Form state
  const [formData, setFormData] = useState({
    donorName: '',
    donorEmail: '',
    pledgeAmount: '', // For recurring, this is the per-period amount
    pledgeType: 'one-time', // 'one-time' or 'regular'
    recurringFrequency: 'Monthly', // New state for frequency
    startDate: new Date().toISOString().split('T')[0], // Today's date
    endDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionType, setSubmissionType] = useState('pledge'); // 'pledge' or 'gift'
  const [pledgeIdForGift, setPledgeIdForGift] = useState(null); // To link gift to pledge

  // Calculate number of periods between two dates
  const calculatePeriods = (startDate, endDate, frequency) => {
    if (!startDate || !endDate || !frequency) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) return 1; // Minimum 1 period
    
    let periods = 0;
    
    switch (frequency) {
      case 'Monthly':
        periods = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
        break;
      case 'Quarterly':
        const quartersDiff = Math.floor(
          ((end.getFullYear() - start.getFullYear()) * 12 + 
           (end.getMonth() - start.getMonth())) / 3
        );
        periods = quartersDiff;
        break;
      case 'Annually':
        periods = end.getFullYear() - start.getFullYear();
        break;
      default:
        periods = 0;
    }
    
    return Math.max(1, periods); // Minimum 1 period
  };

  // Calculate total pledge amount for recurring pledges
  const calculateTotalAmount = () => {
    if (formData.pledgeType !== 'regular' || !formData.pledgeAmount || !formData.startDate || !formData.endDate || !formData.recurringFrequency) {
      return null;
    }
    
    const perPeriodAmount = parseFloat(String(formData.pledgeAmount).replace(/[$,]/g, ''));
    if (isNaN(perPeriodAmount)) return null;
    
    const periods = calculatePeriods(formData.startDate, formData.endDate, formData.recurringFrequency);
    return perPeriodAmount * periods;
  };

  const totalRecurringAmount = calculateTotalAmount();


  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        setError('');

        // Extract and validate URL parameters
        const { campaignId, campusId, errors, isValid } = extractPledgeParams(location.search);
        
        if (!isValid) {
          setError(formatParamErrors(errors));
          setLoading(false);
          return;
        }

        // Validate ID formats
        const { isValid: idsValid, errors: idErrors } = validatePledgeIds(campaignId, campusId);
        if (!idsValid) {
          setError(formatParamErrors(idErrors));
          setLoading(false);
          return;
        }

        console.log('PledgePage: Loading data for campaign:', campaignId, 'campus:', campusId);

        // Fetch campaign and campus data
        const [campaignData, campusesData] = await Promise.all([
          fetchCampaignById(campaignId),
          fetchCampuses()
        ]);

        // Find the specific campus
        const campusData = campusesData.find(c => c.id === campusId);
        
        if (!campaignData) {
          setError('Campaign not found. Please contact the organization for a valid donation link.');
          setLoading(false);
          return;
        }

        if (!campusData) {
          setError('Campus not found. Please contact the organization for a valid donation link.');
          setLoading(false);
          return;
        }

        // Verify that this campus is assigned to the campaign
        if (!campaignData.assignedCampuses.includes(campusId)) {
          setError('This campus is not participating in this campaign. Please contact the organization.');
          setLoading(false);
          return;
        }

        setCampaign(campaignData);
        setCampus(campusData);
        console.log('PledgePage: Data loaded successfully', { campaignData, campusData });

      } catch (err) {
        console.error('PledgePage: Error loading data:', err);
        setError('Unable to load campaign information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [location.search]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // If changing pledge type, reset end date for one-time pledges
    if (name === 'pledgeType' && value === 'one-time') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        endDate: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle moving to step 2 (personal details)
  const handleProceedToPersonalDetails = (e) => {
    e.preventDefault();
    
    // Basic validation for step 1
    if (!formData.pledgeAmount || formData.pledgeAmount <= 0) {
      alert('Please enter a valid pledge amount.');
      return;
    }
    
    if (formData.pledgeType === 'regular' && (!formData.endDate || !formData.recurringFrequency)) {
      alert('Please select a frequency and an ending date for regular pledges.');
      return;
    }
    
    console.log('PledgePage: Moving to step 2 with data:', formData);
    setCurrentStep(2);
  };

  // Handle moving to step 3 (confirm pledge)
  const handleProceedToConfirmation = (e) => {
    e.preventDefault();
    
    // Validation for personal details
    if (!formData.donorName.trim() || !formData.donorEmail.trim()) {
      alert('Please fill in all required fields.');
      return;
    }
    
    console.log('PledgePage: Moving to confirmation step with data:', formData);
    setCurrentStep(3);
  };

  // Handle going to gift confirmation (Step 5)
  const handleGoToGiftConfirmation = () => {
    console.log('PledgePage: Moving to gift confirmation step');
    setCurrentStep(5);
  };

  // Handle going back to previous step
  const handleBackToStep = (stepNumber) => {
    setCurrentStep(stepNumber);
  };

  // REFACTORED: Reusable function to create a pledge record
  const createNewPledgeRecord = async () => {
    // For recurring pledges, the total amount is saved. For one-time, it's the entered amount.
    const amountToSave = formData.pledgeType === 'regular' ? totalRecurringAmount : formData.pledgeAmount;

    const pledgeData = {
      campaignId: campaign.id,
      campusId: campus.id,
      donorName: formData.donorName,
      donorEmail: formData.donorEmail,
      pledgeAmount: amountToSave, // Use the calculated total for recurring
      pledgeType: formData.pledgeType,
      recurringFrequency: formData.recurringFrequency,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: `Pledge created via donor portal for ${campaign.name} at ${campus.name}`
    };
    const createdPledge = await createPledge(pledgeData);
    return createdPledge;
  };

  // Handle final payment processing
  const handleProcessPayment = async () => {
    setSubmitting(true);
    setSubmissionType('gift'); // Set submission type to 'gift'

    try {
      console.log('PledgePage: Processing payment and creating gift:', {
        campaign: campaign.id,
        campus: campus.id,
        donor: formData
      });

      // For a recurring gift, we only save the FIRST gift (per-period amount)
      // For a one-time gift, it's also the entered amount.
      const giftAmount = formData.pledgeAmount;

      // Create gift record in Airtable
      const giftData = {
        donorName: formData.donorName,
        donorEmail: formData.donorEmail,
        amount: giftAmount,
        campaignId: campaign.id,
        campusId: campus.id,
        giftType: formData.pledgeType === 'regular' ? 'Recurring' : 'One-time',
        // CORRECTED: Pass the frequency
        recurringFrequency: formData.recurringFrequency,
      };

      await createGift(giftData);
      
      setSubmitted(true);
      console.log('PledgePage: Payment processed and gift created successfully');

    } catch (err) {
      console.error('PledgePage: Error processing payment:', err);
      alert('Error processing payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle pledge now (create pledge record)
  const handlePledgeNow = async () => {
    setSubmitting(true);
    setSubmissionType('pledge'); // Set submission type to 'pledge'
    setDuplicatePledgeError(null); // Clear any previous errors

    try {
      // Step 1: Check for existing pledge
      const existingCheck = await checkExistingPledge(formData.donorEmail, campaign.id, campus.id);
      if (existingCheck.exists) {
        throw new Error(`DUPLICATE_PLEDGE:A pledge already exists for this email and campaign.`);
      }

      // Step 2: Create new pledge
      await createNewPledgeRecord();
      
      setSubmitted(true);
      console.log('PledgePage: Pledge created successfully:');

    } catch (err) {
      console.error('PledgePage: Error creating pledge:', err);
      
      // Check if it's a duplicate pledge error
      if (err.message && err.message.startsWith('DUPLICATE_PLEDGE:')) {
        const errorMessage = err.message.replace('DUPLICATE_PLEDGE:', '');
        setDuplicatePledgeError(errorMessage);
      } else {
        alert('Error creating pledge. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ENHANCED: Handle pledge and pay (check for pledge, create if needed, then move to payment)
  const handlePledgeAndPay = async () => {
    setSubmitting(true);
    setDuplicatePledgeError(null);

    try {
      // Check if a pledge already exists
      const existingCheck = await checkExistingPledge(formData.donorEmail, campaign.id, campus.id);

      if (existingCheck.exists) {
        console.log('PledgePage: Existing pledge found. ID:', existingCheck.pledgeId);
        // Store the existing pledge ID for gift linking
        setPledgeIdForGift(existingCheck.pledgeId);
      } else {
        console.log('PledgePage: No existing pledge. Creating a new one.');
        // Create a new pledge if one doesn't exist
        const newPledge = await createNewPledgeRecord();
        console.log('PledgePage: New pledge created. ID:', newPledge.id);
        // Store the new pledge ID for gift linking
        setPledgeIdForGift(newPledge.id);
      }

      // Proceed to payment steps
      setCurrentStep(4);

    } catch (err) {
      console.error('PledgePage: Error during pledge and pay process:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // This function now acts as a gatekeeper to the confirmation step
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setCurrentStep(3); // Go to the confirmation step for all pledge types
  };

  if (loading) {
    return (
      <div className="pledge-page">
        <div className="pledge-hero">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading campaign information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pledge-page">
        <div className="pledge-hero">
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h2>Unable to Load Campaign</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="pledge-page">
        {/* Header */}
        <header className="pledge-header">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo-circle">
                <span className="logo-icon">⛪</span>
              </div>
              <span className="org-name">ARCHDIOCESE OF SEATTLE</span>
            </div>
            <div className="header-actions">
              <span className="language-link">Español</span>
              <span className="account-link">Your Account 👤</span>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="pledge-hero">
          <div className="hero-content">
            <h1 className="campaign-title">{campaign.name}</h1>
            <p className="campus-subtitle">Archdiocese of Seattle - {campus.name}</p>
            <h2 className="pledge-heading">Make a {submissionType === 'gift' ? 'gift' : 'pledge'}</h2>
            
            {/* Amount Display */}
            <div className="amount-display">
              <span className="currency">$</span>
              <span className="amount-input-large">{parseFloat(formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <p className="amount-label">Your total</p>
          </div>
        </div>

        {/* Content Card - Success State */}
        <div className="content-card">
          <div className="card-content">
            <div className="success-content">
              <div className="success-icon-large">✅</div>
              <h2 className="success-title">Thank You for Your {submissionType === 'gift' ? 'Gift' : 'Pledge'}!</h2>
              <p className="success-message">
                Your {formData.pledgeType === 'regular' ? 'recurring' : 'one-time'} {submissionType === 'gift' ? 'gift' : 'pledge'} of <strong>${formData.pledgeAmount}</strong> to <strong>{campaign.name}</strong> at <strong>{campus.name}</strong> has been {submissionType === 'gift' ? 'processed' : 'recorded'}.
              </p>
            </div>

            {/* Footer */}
            <div className="form-footer">
              <p className="legal-text">
                <a href="#">Pushpay Terms & Conditions</a> and <a href="#">Privacy Policy</a>
              </p>
              <p className="org-info">
                Organization Legal Name: Archdiocese of Seattle | Address: 710 9th Avenue, Seattle, WA 98104
              </p>
            </div>
          </div>
        </div>
        
        {/* Pushpay Footer */}
        <div className="pushpay-footer">
          <div className="footer-content">
            <div className="pushpay-logo">Ⓟ Pushpay</div>
            <div>
              <a href="#" style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: '12px' }}>Help Center</a>
              <span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>© Pushpay® Ltd. All rights reserved</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pledge-page">
      {/* Header */}
      <header className="pledge-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-circle">
              <span className="logo-icon">⛪</span>
            </div>
            <span className="org-name">ARCHDIOCESE OF SEATTLE</span>
          </div>
          <div className="header-actions">
            <span className="language-link">Español</span>
            <span className="account-link">Your Account 👤</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="pledge-hero">
        <div className="hero-content">
          <h1 className="campaign-title">{campaign.name}</h1>
          <p className="campus-subtitle">Archdiocese of Seattle - {campus.name}</p>
          <h2 className="pledge-heading">Make a pledge</h2>
          
          {/* Amount Input */}
          <div className="amount-display">
            <span className="currency">$</span>
            <input
              type="number"
              value={formData.pledgeAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, pledgeAmount: e.target.value }))}
              placeholder="0.00"
              className="amount-input-large"
              min="0"
              step="0.01"
              disabled={currentStep > 1}
            />
          </div>
           {/* NEW: Total amount display for recurring pledges */}
           {formData.pledgeType === 'regular' && totalRecurringAmount && (
              <p className="amount-label">
                Your total pledge will be <strong>${totalRecurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </p>
            )}
            {!totalRecurringAmount && <p className="amount-label">Your total</p>}
        </div>
      </div>

      {/* Content Card */}
      <div className="content-card">
        <div className="card-content">
          
          {/* Step 1: Pledge Details */}
          {currentStep === 1 && (
            <>
              {/* Campaign Description */}
              <div className="campaign-section">
                <h3>About the campaign</h3>
                <p>
                  {campaign.description || 
                    "Support our church's mission! Help us raise funds for community outreach, youth programs, and building improvements. Every gift makes a difference—thank you for being part of the work God is doing here!"
                  }
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleProceedToPersonalDetails} className="pledge-form-new">
                {/* Pledge Type Selection */}
                <div className="form-section">
                  <h4>How will you fulfill your pledge?</h4>
                  <div className="pledge-type-buttons">
                    <button
                      type="button"
                      className={`type-btn ${formData.pledgeType === 'one-time' ? 'active' : ''}`}
                      onClick={() => handleInputChange({ target: { name: 'pledgeType', value: 'one-time' } })}
                    >
                      <span className="btn-icon">👤</span>
                      Give one time
                    </button>
                    <button
                      type="button"
                      className={`type-btn ${formData.pledgeType === 'regular' ? 'active' : ''}`}
                      onClick={() => handleInputChange({ target: { name: 'pledgeType', value: 'regular' } })}
                    >
                      <span className="btn-icon">🔄</span>
                      Give regularly
                    </button>
                  </div>
                </div>

                {/* UPDATED: Frequency Buttons */}
                {formData.pledgeType === 'regular' && (
                  <div className="form-section">
                    <h4 style={{textAlign: 'center', marginBottom: '16px'}}>Frequency</h4>
                    <div className="pledge-type-buttons" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                      <button
                        type="button"
                        className={`type-btn ${formData.recurringFrequency === 'Monthly' ? 'active' : ''}`}
                        onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Monthly' } })}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        className={`type-btn ${formData.recurringFrequency === 'Quarterly' ? 'active' : ''}`}
                        onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Quarterly' } })}
                      >
                        Quarterly
                      </button>
                      <button
                        type="button"
                        className={`type-btn ${formData.recurringFrequency === 'Annually' ? 'active' : ''}`}
                        onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Annually' } })}
                      >
                        Annually
                      </button>
                    </div>
                  </div>
                )}


                {/* Date Fields */}
                <div className="form-section">
                  <div className="date-fields">
                    <div className="date-field">
                      <label htmlFor="startDate">Starting</label>
                      <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    
                    {formData.pledgeType === 'regular' && (
                      <div className="date-field">
                        <label htmlFor="endDate">Ending</label>
                        <input
                          type="date"
                          id="endDate"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleInputChange}
                          required={formData.pledgeType === 'regular'}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit" 
                  className="next-btn"
                  disabled={!formData.pledgeAmount || formData.pledgeAmount <= 0}
                >
                  Next
                </button>
              </form>
            </>
          )}

          {/* Step 2: Personal Details */}
          {currentStep === 2 && (
            <>
              {/* Personal Details Header */}
              <div className="personal-details-header">
                <h3>PERSONAL DETAILS</h3>
                <p>Enter your name and email to create an account.</p>
              </div>

              {/* Personal Details Form */}
              <form 
                onSubmit={handleFinalSubmit} 
                className="personal-details-form"
              >
                <div className="form-group">
                  <label htmlFor="donorName">Full Name *</label>
                  <input
                    type="text"
                    id="donorName"
                    name="donorName"
                    value={formData.donorName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="donorEmail">Email Address *</label>
                  <input
                    type="email"
                    id="donorEmail"
                    name="donorEmail"
                    value={formData.donorEmail}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your email address"
                  />
                </div>

                {/* Action Buttons */}
                <div className="step2-actions">
                  <button 
                    type="button" 
                    className="back-btn"
                    onClick={() => handleBackToStep(1)}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="next-btn"
                    disabled={submitting || !formData.donorName || !formData.donorEmail}
                  >
                    {submitting ? 'Processing...' : 'Next'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Step 3: Confirm Your Pledge (for ALL pledge types) */}
          {currentStep === 3 && (
            <>
              <div className="confirmation-header">
                <h3>CONFIRM YOUR PLEDGE</h3>
                <p>You are about to pledge</p>
              </div>

              <div className="confirmation-amount">
                <span className="conf-currency">$</span>
                <span className="conf-amount">
                  {parseFloat(formData.pledgeType === 'regular' ? totalRecurringAmount : formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {formData.pledgeType === 'regular' && (
                  <p style={{fontSize: '16px', color: '#6b7280', marginTop: '8px'}}>
                    (${formData.pledgeAmount} per month)
                  </p>
                )}
              </div>

              <div className="confirmation-campaign">
                <p>to <strong>{campaign.name}</strong></p>
                <button 
                  type="button" 
                  className="change-details-btn"
                  onClick={() => handleBackToStep(1)}
                >
                  ✏️ Change details
                </button>
              </div>

              <div className="confirmation-actions">
                {duplicatePledgeError && (
                  <div className="duplicate-pledge-error">
                    <div className="error-icon-small">⚠️</div>
                    <div className="error-content">
                      <h4>Pledge Already Exists</h4>
                      <p>{duplicatePledgeError}</p>
                      <button 
                        className="dismiss-error-btn"
                        onClick={() => setDuplicatePledgeError(null)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  className="pledge-pay-btn"
                  onClick={handlePledgeAndPay}
                  disabled={submitting || duplicatePledgeError}
                >
                  {submitting ? 'Processing...' : 'Go to payment method'}
                </button>
                <button 
                  className="pledge-only-btn"
                  onClick={handlePledgeNow}
                  disabled={submitting || duplicatePledgeError}
                >
                  {submitting ? 'Processing...' : 'Pledge now, set payment later'}
                </button>
              </div>
            </>
          )}

           {/* Step 4: Payment Method */}
           {currentStep === 4 && (
            <>
              {/* Payment Method Header */}
              <div className="payment-header">
                <h3>How would you like to give?</h3>
              </div>

              {/* Gift Type Selection */}
              <div className="gift-type-section">
                <h4>Gift type</h4>
                <div className="gift-type-buttons">
                  <button type="button" className={`gift-type-btn ${formData.pledgeType === 'one-time' ? 'active' : ''}`}>
                    <span className="gift-icon">💰</span>
                    Give one time
                  </button>
                  <button type="button" className={`gift-type-btn ${formData.pledgeType === 'regular' ? 'active' : ''}`}>
                    <span className="gift-icon">🔄</span>
                    Set up recurring
                  </button>
                </div>
              </div>

              {/* Fund Selection */}
              <div className="fund-section">
                <h4>Fund</h4>
                <div className="fund-display">
                  Tithes & Contributions
                </div>
              </div>

              {/* Payment Method Card */}
              <div className="payment-method-card">
                <h4>Payment method</h4>
                
                <div className="selected-payment-method">
                  <div className="payment-card">
                    <div className="card-info">
                      <div className="card-type">Visa</div>
                      <div className="card-number">•••• •••• •••• 1234</div>
                      <div className="card-expiry">Expiry: 12/2032</div>
                    </div>
                    <div className="card-actions">
                      <div className="selected-indicator">✓</div>
                      <div className="visa-logo">VISA</div>
                    </div>
                  </div>
                </div>

                <button className="add-payment-method" disabled>
                  <span className="plus-icon">+</span>
                  Add new payment method
                </button>
              </div>

              {/* Payment Actions */}
              <div className="payment-actions">
                <button 
                  className="process-payment-btn"
                  onClick={handleGoToGiftConfirmation}
                  disabled={submitting}
                >
                  {submitting ? 'Processing Payment...' : 'Next'}
                </button>
              </div>
            </>
          )}

          {/* Step 5: Confirm Your Gift */}
           {currentStep === 5 && (
            <>
              <div className="confirmation-header">
                <h3>{formData.pledgeType === 'regular' ? 'Giving Summary' : 'Confirm Your Gift'}</h3>
                 <p>Review your gift details before completing payment</p>
              </div>

              {/* Conditional Summary Display */}
              {formData.pledgeType === 'regular' ? (
                // NEW Recurring Gift Summary
                <div className="pledge-summary">
                  <div className="summary-item">
                    <span className="summary-label">Contribution ({formData.recurringFrequency}):</span>
                    <span className="summary-value">${parseFloat(formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Starting on:</span>
                    <span className="summary-value">{new Date(formData.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Ending on:</span>
                    <span className="summary-value">{new Date(formData.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />
                  <div className="summary-item">
                    <span className="summary-label">Total Contribution:</span>
                    <span className="summary-value">${totalRecurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Number of Gifts:</span>
                    <span className="summary-value">{calculatePeriods(formData.startDate, formData.endDate, formData.recurringFrequency)} gifts</span>
                  </div>
                </div>
              ) : (
                // Original One-Time Gift Summary
                <div className="pledge-summary">
                  <div className="summary-item">
                    <span className="summary-label">Amount:</span>
                    <span className="summary-value">${parseFloat(formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Type:</span>
                    <span className="summary-value">One-time gift</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Fund:</span>
                    <span className="summary-value">Tithes & Contributions</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Campaign:</span>
                    <span className="summary-value">{campaign.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Campus:</span>
                    <span className="summary-value">{campus.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Payment method:</span>
                    <span className="summary-value">Visa •••• 1234</span>
                  </div>
                </div>
              )}
              
              <div className="personal-details-header" style={{ textAlign: 'left', marginBottom: '24px', marginTop: '24px' }}>
                <h3 style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '16px' }}>Donor Information</h3>
                <p style={{fontSize: '14px', color: '#374151'}}><strong>{formData.donorName}</strong></p>
                <p style={{fontSize: '14px', color: '#6b7280'}}>{formData.donorEmail}</p>
              </div>

              {/* Action Buttons */}
              <div className="step2-actions">
                <button 
                  type="button" 
                  className="back-btn"
                  onClick={() => handleBackToStep(4)}
                  disabled={submitting}
                >
                  Back
                </button>
                <button 
                  type="button"
                  className="next-btn"
                  onClick={handleProcessPayment}
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : `Pay $${parseFloat(formData.pledgeAmount).toLocaleString()}`}
                </button>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="form-footer">
            <p className="legal-text">
              <a href="#">Pushpay Terms & Conditions</a> and <a href="#">Privacy Policy</a>
            </p>
            <p className="org-info">
              Organization Legal Name: Archdiocese of Seattle | Address: 710 9th Avenue, Seattle, WA 98104
            </p>
          </div>
        </div>
      </div>
      
      {/* Pushpay Footer */}
      <div className="pushpay-footer">
        <div className="footer-content">
          <div className="pushpay-logo">Ⓟ Pushpay</div>
          <div>
            <a href="#" style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: '12px' }}>Help Center</a>
            <span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>© Pushpay® Ltd. All rights reserved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PledgePage;