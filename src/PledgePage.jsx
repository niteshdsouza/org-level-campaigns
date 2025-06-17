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
  const [campus, setCampus] = useState(null); // This will hold the selected campus object
  
  // State for the campus selector
  const [availableCampuses, setAvailableCampuses] = useState([]);
  const [isCampusSelectionMode, setIsCampusSelectionMode] = useState(false);


  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [duplicatePledgeError, setDuplicatePledgeError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    donorName: '',
    donorEmail: '',
    pledgeAmount: '',
    pledgeType: 'one-time',
    recurringFrequency: 'Monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionType, setSubmissionType] = useState('pledge');
  const [pledgeIdForGift, setPledgeIdForGift] = useState(null);

  const calculatePeriods = (startDate, endDate, frequency) => {
    if (!startDate || !endDate || !frequency) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) return 1;
    let periods = 0;
    switch (frequency) {
      case 'Monthly':
        periods = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        break;
      case 'Quarterly':
        periods = Math.floor(((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 3);
        break;
      case 'Annually':
        periods = end.getFullYear() - start.getFullYear();
        break;
      default:
        periods = 0;
    }
    return Math.max(1, periods);
  };

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
        const params = new URLSearchParams(location.search);
        const campaignId = params.get('campaign');
        const campusId = params.get('campus');

        if (!campaignId) {
          setError(formatParamErrors(['Campaign ID is missing.']));
          setLoading(false);
          return;
        }

        const campaignData = await fetchCampaignById(campaignId);
        if (!campaignData) {
          setError('Campaign not found. Please contact the organization for a valid donation link.');
          setLoading(false);
          return;
        }
        setCampaign(campaignData);

        const allCampuses = await fetchCampuses();

        if (campusId) {
          const campusData = allCampuses.find(c => c.id === campusId);
          if (!campusData || !campaignData.assignedCampuses.includes(campusId)) {
            setError('The provided campus is not valid for this campaign.');
            setLoading(false);
            return;
          }
          setCampus(campusData);
          setIsCampusSelectionMode(false);
        } else {
          const assigned = allCampuses.filter(c => campaignData.assignedCampuses.includes(c.id));
          if (assigned.length === 0) {
            setError('This campaign has no campuses assigned to it.');
            setLoading(false);
            return;
          }
          setAvailableCampuses(assigned);
          setIsCampusSelectionMode(true);
        }
      } catch (err) {
        console.error('PledgePage: Error loading data:', err);
        setError('Unable to load campaign information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    loadPageData();
  }, [location.search]);

  const handleCampusSelect = (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      const selected = availableCampuses.find(c => c.id === selectedId);
      setCampus(selected);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'pledgeType' && value === 'one-time') {
      setFormData(prev => ({ ...prev, [name]: value, endDate: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleProceedToPersonalDetails = (e) => {
    e.preventDefault();
    if (!formData.pledgeAmount || formData.pledgeAmount <= 0) {
      alert('Please enter a valid pledge amount.');
      return;
    }
    if (formData.pledgeType === 'regular' && (!formData.endDate || !formData.recurringFrequency)) {
      alert('Please select a frequency and an ending date for regular pledges.');
      return;
    }
    setCurrentStep(2);
  };

  const handleProceedToConfirmation = (e) => {
    e.preventDefault();
    if (!formData.donorName.trim() || !formData.donorEmail.trim()) {
      alert('Please fill in all required fields.');
      return;
    }
    setCurrentStep(3);
  };

  const handleGoToGiftConfirmation = () => setCurrentStep(5);

  const handleBackToStep = (stepNumber) => setCurrentStep(stepNumber);

  const createNewPledgeRecord = async () => {
    const amountToSave = formData.pledgeType === 'regular' ? totalRecurringAmount : formData.pledgeAmount;
    const pledgeData = {
      campaignId: campaign.id,
      campusId: campus.id,
      donorName: formData.donorName,
      donorEmail: formData.donorEmail,
      pledgeAmount: amountToSave,
      pledgeType: formData.pledgeType,
      recurringFrequency: formData.recurringFrequency,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: `Pledge created via donor portal for ${campaign.name} at ${campus.name}`
    };
    return await createPledge(pledgeData);
  };

  const handleProcessPayment = async () => {
    setSubmitting(true);
    setSubmissionType('gift');
    try {
      const giftAmount = formData.pledgeAmount;
      const giftData = {
        donorName: formData.donorName,
        donorEmail: formData.donorEmail,
        amount: giftAmount,
        campaignId: campaign.id,
        campusId: campus.id,
        giftType: formData.pledgeType === 'regular' ? 'Recurring' : 'One-time',
        recurringFrequency: formData.recurringFrequency,
      };
      await createGift(giftData);
      setSubmitted(true);
    } catch (err) {
      console.error('PledgePage: Error processing payment:', err);
      alert('Error processing payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePledgeNow = async () => {
    setSubmitting(true);
    setSubmissionType('pledge');
    setDuplicatePledgeError(null);
    try {
      const existingCheck = await checkExistingPledge(formData.donorEmail, campaign.id, campus.id);
      if (existingCheck.exists) {
        throw new Error(`DUPLICATE_PLEDGE:A pledge already exists for this email and campaign.`);
      }
      await createNewPledgeRecord();
      setSubmitted(true);
    } catch (err) {
      if (err.message?.startsWith('DUPLICATE_PLEDGE:')) {
        setDuplicatePledgeError(err.message.replace('DUPLICATE_PLEDGE:', ''));
      } else {
        alert('Error creating pledge. Please try again.');
      }
      console.error('PledgePage: Error creating pledge:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePledgeAndPay = async () => {
    setSubmitting(true);
    setDuplicatePledgeError(null);
    try {
      const existingCheck = await checkExistingPledge(formData.donorEmail, campaign.id, campus.id);
      if (existingCheck.exists) {
        setPledgeIdForGift(existingCheck.pledgeId);
      } else {
        const newPledge = await createNewPledgeRecord();
        setPledgeIdForGift(newPledge.id);
      }
      setCurrentStep(4);
    } catch (err) {
      alert('An error occurred. Please try again.');
      console.error('PledgePage: Error during pledge and pay process:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalSubmit = (e) => {
    e.preventDefault();
    setCurrentStep(3);
  };

  if (loading) {
    return (
      <div className="pledge-page">
        <div className="pledge-hero"><div className="loading-state"><div className="loading-spinner"></div><p>Loading campaign information...</p></div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pledge-page">
        <div className="pledge-hero"><div className="error-state"><div className="error-icon">⚠️</div><h2>Unable to Load Campaign</h2><p>{error}</p></div></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="pledge-page">
        <header className="pledge-header"><div className="header-content"><div className="logo-section"><div className="logo-circle"><span className="logo-icon">⛪</span></div><span className="org-name">ARCHDIOCESE OF SEATTLE</span></div><div className="header-actions"><span className="language-link">Español</span><span className="account-link">Your Account 👤</span></div></div></header>
        <div className="pledge-hero">
          <div className="hero-content">
            <h1 className="campaign-title">{campaign.name}</h1>
            <p className="campus-subtitle">Archdiocese of Seattle - {campus.name}</p>
            <h2 className="pledge-heading">Make a {submissionType === 'gift' ? 'gift' : 'pledge'}</h2>
            <div className="amount-display"><span className="currency">$</span><span className="amount-input-large">{parseFloat(formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <p className="amount-label">Your total</p>
          </div>
        </div>
        <div className="content-card"><div className="card-content">
          <div className="success-content">
            <div className="success-icon-large">✅</div>
            <h2 className="success-title">Thank You for Your {submissionType === 'gift' ? 'Gift' : 'Pledge'}!</h2>
            <p className="success-message">Your {formData.pledgeType === 'regular' ? 'recurring' : 'one-time'} {submissionType === 'gift' ? 'gift' : 'pledge'} of <strong>${formData.pledgeAmount}</strong> to <strong>{campaign.name}</strong> at <strong>{campus.name}</strong> has been {submissionType === 'gift' ? 'processed' : 'recorded'}.</p>
          </div>
          <div className="form-footer"><p className="legal-text"><a href="#">Pushpay Terms & Conditions</a> and <a href="#">Privacy Policy</a></p><p className="org-info">Organization Legal Name: Archdiocese of Seattle | Address: 710 9th Avenue, Seattle, WA 98104</p></div>
        </div></div>
        <div className="pushpay-footer"><div className="footer-content"><div className="pushpay-logo">Ⓟ Pushpay</div><div><a href="#" style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: '12px' }}>Help Center</a><span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span><span style={{ fontSize: '12px', color: '#9ca3af' }}>© Pushpay® Ltd. All rights reserved</span></div></div></div>
      </div>
    );
  }

  return (
    <div className="pledge-page">
      <header className="pledge-header"><div className="header-content"><div className="logo-section"><div className="logo-circle"><span className="logo-icon">⛪</span></div><span className="org-name">ARCHDIOCESE OF SEATTLE</span></div><div className="header-actions"><span className="language-link">Español</span><span className="account-link">Your Account 👤</span></div></div></header>
      <div className="pledge-hero">
        <div className="hero-content">
          <h1 className="campaign-title">{campaign?.name}</h1>
          <p className="campus-subtitle">{campus ? `Archdiocese of Seattle - ${campus.name}` : ' '}</p>
          <h2 className="pledge-heading">Make a pledge</h2>
          <div className="amount-display">
            <span className="currency">$</span>
            <input type="number" value={formData.pledgeAmount} onChange={(e) => setFormData(prev => ({ ...prev, pledgeAmount: e.target.value }))} placeholder="0.00" className="amount-input-large" min="0" step="0.01" disabled={!campus || currentStep > 1} />
          </div>
          {formData.pledgeType === 'regular' && totalRecurringAmount && (<p className="amount-label">Your total pledge will be <strong>${totalRecurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>)}
          {!totalRecurringAmount && <p className="amount-label">Your total</p>}
        </div>
      </div>
      <div className="content-card"><div className="card-content">
        {currentStep === 1 && (
          <form onSubmit={handleProceedToPersonalDetails} className="pledge-form-new">
            <div className="campaign-section"><h3>About the campaign</h3><p>{campaign.description || "Support our church's mission!"}</p></div>
            
            {/* NEW: Integrated Campus Selector */}
            {isCampusSelectionMode && (
              <div className="form-section form-campus-selector">
                <h4 className="form-section-header">Select Your Campus</h4>
                <select id="campus-select" className="campus-select-dropdown" onChange={handleCampusSelect} defaultValue="">
                  <option value="" disabled>Choose a campus...</option>
                  {availableCampuses.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            )}
            
            <fieldset disabled={!campus}>
              <div className="form-section">
                <h4>How will you fulfill your pledge?</h4>
                <div className="pledge-type-buttons">
                  <button type="button" className={`type-btn ${formData.pledgeType === 'one-time' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'pledgeType', value: 'one-time' } })}><span className="btn-icon">👤</span> Give one time</button>
                  <button type="button" className={`type-btn ${formData.pledgeType === 'regular' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'pledgeType', value: 'regular' } })}><span className="btn-icon">🔄</span> Give regularly</button>
                </div>
              </div>
              {formData.pledgeType === 'regular' && (
                <div className="form-section">
                  <h4 style={{textAlign: 'center', marginBottom: '16px'}}>Frequency</h4>
                  <div className="pledge-type-buttons" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <button type="button" className={`type-btn ${formData.recurringFrequency === 'Monthly' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Monthly' } })}>Monthly</button>
                    <button type="button" className={`type-btn ${formData.recurringFrequency === 'Quarterly' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Quarterly' } })}>Quarterly</button>
                    <button type="button" className={`type-btn ${formData.recurringFrequency === 'Annually' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Annually' } })}>Annually</button>
                  </div>
                </div>
              )}
              <div className="form-section">
                <div className="date-fields">
                  <div className="date-field"><label htmlFor="startDate">Starting</label><input type="date" id="startDate" name="startDate" value={formData.startDate} onChange={handleInputChange} required /></div>
                  {formData.pledgeType === 'regular' && (<div className="date-field"><label htmlFor="endDate">Ending</label><input type="date" id="endDate" name="endDate" value={formData.endDate} onChange={handleInputChange} required={formData.pledgeType === 'regular'} /></div>)}
                </div>
              </div>
              <button type="submit" className="next-btn" disabled={!formData.pledgeAmount || formData.pledgeAmount <= 0}>Next</button>
            </fieldset>
          </form>
        )}

        {currentStep === 2 && (
          <form onSubmit={handleFinalSubmit} className="personal-details-form">
            <div className="personal-details-header"><h3>PERSONAL DETAILS</h3><p>Enter your name and email to create an account.</p></div>
            <div className="form-group"><label htmlFor="donorName">Full Name *</label><input type="text" id="donorName" name="donorName" value={formData.donorName} onChange={handleInputChange} required placeholder="Enter your full name" /></div>
            <div className="form-group"><label htmlFor="donorEmail">Email Address *</label><input type="email" id="donorEmail" name="donorEmail" value={formData.donorEmail} onChange={handleInputChange} required placeholder="Enter your email address" /></div>
            <div className="step2-actions"><button type="button" className="back-btn" onClick={() => handleBackToStep(1)}>Back</button><button type="submit" className="next-btn" disabled={submitting || !formData.donorName || !formData.donorEmail}>{submitting ? 'Processing...' : 'Next'}</button></div>
          </form>
        )}
        
        {currentStep === 3 && (
            <>
              <div className="confirmation-header"><h3>CONFIRM YOUR PLEDGE</h3><p>You are about to pledge</p></div>
              <div className="confirmation-amount"><span className="conf-currency">$</span><span className="conf-amount">{parseFloat(formData.pledgeType === 'regular' ? totalRecurringAmount : formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>{formData.pledgeType === 'regular' && (<p style={{fontSize: '16px', color: '#6b7280', marginTop: '8px'}}>(${formData.pledgeAmount} per month)</p>)}</div>
              <div className="confirmation-campaign"><p>to <strong>{campaign.name}</strong></p><button type="button" className="change-details-btn" onClick={() => handleBackToStep(1)}>✏️ Change details</button></div>
              <div className="confirmation-actions">
                {duplicatePledgeError && (<div className="duplicate-pledge-error"><div className="error-icon-small">⚠️</div><div className="error-content"><h4>Pledge Already Exists</h4><p>{duplicatePledgeError}</p><button className="dismiss-error-btn" onClick={() => setDuplicatePledgeError(null)}>Dismiss</button></div></div>)}
                <button className="pledge-pay-btn" onClick={handlePledgeAndPay} disabled={submitting || duplicatePledgeError}>{submitting ? 'Processing...' : 'Go to payment method'}</button>
                <button className="pledge-only-btn" onClick={handlePledgeNow} disabled={submitting || duplicatePledgeError}>{submitting ? 'Processing...' : 'Pledge now, set payment later'}</button>
              </div>
            </>
        )}

        {currentStep === 4 && (
            <>
              <div className="payment-header"><h3>How would you like to give?</h3></div>
              <div className="gift-type-section"><h4>Gift type</h4><div className="gift-type-buttons"><button type="button" className={`gift-type-btn ${formData.pledgeType === 'one-time' ? 'active' : ''}`}><span className="gift-icon">💰</span>Give one time</button><button type="button" className={`gift-type-btn ${formData.pledgeType === 'regular' ? 'active' : ''}`}><span className="gift-icon">🔄</span>Set up recurring</button></div></div>
              <div className="fund-section"><h4>Fund</h4><div className="fund-display">Tithes & Contributions</div></div>
              <div className="payment-method-card">
                <h4>Payment method</h4>
                <div className="selected-payment-method"><div className="payment-card"><div className="card-info"><div className="card-type">Visa</div><div className="card-number">•••• •••• •••• 1234</div><div className="card-expiry">Expiry: 12/2032</div></div><div className="card-actions"><div className="selected-indicator">✓</div><div className="visa-logo">VISA</div></div></div></div>
                <button className="add-payment-method" disabled><span className="plus-icon">+</span>Add new payment method</button>
              </div>
              <div className="payment-actions"><button className="process-payment-btn" onClick={handleGoToGiftConfirmation} disabled={submitting}>{submitting ? 'Processing Payment...' : 'Next'}</button></div>
            </>
        )}

        {currentStep === 5 && (
            <>
              <div className="confirmation-header"><h3>{formData.pledgeType === 'regular' ? 'Giving Summary' : 'Confirm Your Gift'}</h3><p>Review your gift details before completing payment</p></div>
              {formData.pledgeType === 'regular' ? (
                <div className="pledge-summary">
                  <div className="summary-item"><span className="summary-label">Contribution ({formData.recurringFrequency}):</span><span className="summary-value">${parseFloat(formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="summary-item"><span className="summary-label">Starting on:</span><span className="summary-value">{new Date(formData.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  <div className="summary-item"><span className="summary-label">Ending on:</span><span className="summary-value">{new Date(formData.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />
                  <div className="summary-item"><span className="summary-label">Total Contribution:</span><span className="summary-value">${totalRecurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="summary-item"><span className="summary-label">Total Number of Gifts:</span><span className="summary-value">{calculatePeriods(formData.startDate, formData.endDate, formData.recurringFrequency)} gifts</span></div>
                </div>
              ) : (
                <div className="pledge-summary">
                  <div className="summary-item"><span className="summary-label">Amount:</span><span className="summary-value">${parseFloat(formData.pledgeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="summary-item"><span className="summary-label">Type:</span><span className="summary-value">One-time gift</span></div>
                  <div className="summary-item"><span className="summary-label">Fund:</span><span className="summary-value">Tithes & Contributions</span></div>
                  <div className="summary-item"><span className="summary-label">Campaign:</span><span className="summary-value">{campaign.name}</span></div>
                  <div className="summary-item"><span className="summary-label">Campus:</span><span className="summary-value">{campus.name}</span></div>
                  <div className="summary-item"><span className="summary-label">Payment method:</span><span className="summary-value">Visa •••• 1234</span></div>
                </div>
              )}
              <div className="personal-details-header" style={{ textAlign: 'left', marginBottom: '24px', marginTop: '24px' }}><h3 style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '16px' }}>Donor Information</h3><p style={{fontSize: '14px', color: '#374151'}}><strong>{formData.donorName}</strong></p><p style={{fontSize: '14px', color: '#6b7280'}}>{formData.donorEmail}</p></div>
              <div className="step2-actions"><button type="button" className="back-btn" onClick={() => handleBackToStep(4)} disabled={submitting}>Back</button><button type="button" className="next-btn" onClick={handleProcessPayment} disabled={submitting}>{submitting ? 'Processing...' : `Pay $${parseFloat(formData.pledgeAmount).toLocaleString()}`}</button></div>
            </>
        )}
        <div className="form-footer"><p className="legal-text"><a href="#">Pushpay Terms & Conditions</a> and <a href="#">Privacy Policy</a></p><p className="org-info">Organization Legal Name: Archdiocese of Seattle | Address: 710 9th Avenue, Seattle, WA 98104</p></div>
      </div></div>
      <div className="pushpay-footer"><div className="footer-content"><div className="pushpay-logo">Ⓟ Pushpay</div><div><a href="#" style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: '12px' }}>Help Center</a><span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span><span style={{ fontSize: '12px', color: '#9ca3af' }}>© Pushpay® Ltd. All rights reserved</span></div></div></div>
    </div>
  );
}

export default PledgePage;