// GivingPage.jsx - Donor-facing giving landing page (MULTI-STEP)
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { extractGivingParams, validateGivingIds, formatParamErrors } from './urlUtils';
import { fetchCampaignById, fetchCampuses, fetchListings, createGift } from './airtable';
import './GivingPage.css'; // Using its own, self-contained stylesheet

function GivingPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Page data
  const [campaign, setCampaign] = useState(null);
  const [campus, setCampus] = useState(null);
  const [listing, setListing] = useState(null);
  const [availableCampuses, setAvailableCampuses] = useState([]);
  const [isCampusSelectionMode, setIsCampusSelectionMode] = useState(false);
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1); // 1: Gift Details, 2: Personal Details, 3: Payment Method, 4: Confirm Gift
  
  // Form state
  const [formData, setFormData] = useState({
    donorName: '',
    donorEmail: '',
    giftAmount: '',
    giftType: 'one-time', // 'one-time' or 'regular'
    recurringFrequency: 'Monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // --- Calculation Helpers ---
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
    if (formData.giftType !== 'regular' || !formData.giftAmount || !formData.startDate || !formData.endDate || !formData.recurringFrequency) {
      return null;
    }
    const perPeriodAmount = parseFloat(String(formData.giftAmount).replace(/[$,]/g, ''));
    if (isNaN(perPeriodAmount)) return null;
    const periods = calculatePeriods(formData.startDate, formData.endDate, formData.recurringFrequency);
    return perPeriodAmount * periods;
  };

  const totalRecurringAmount = calculateTotalAmount();

  // --- Data Loading ---
  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams(location.search);
        const campaignId = params.get('campaign');
        const campusId = params.get('campus'); // Might be null
        const listingId = params.get('listing');

        if (!campaignId || !listingId) {
            setError(formatParamErrors(['Campaign or Listing ID is missing.']));
            setLoading(false);
            return;
        }

        const [campaignData, allCampuses, allListings] = await Promise.all([
          fetchCampaignById(campaignId),
          fetchCampuses(),
          fetchListings()
        ]);

        if (!campaignData) {
            setError('Campaign not found.');
            setLoading(false);
            return;
        }
        setCampaign(campaignData);

        const listingData = allListings.find(l => l.id === listingId);
        if (!listingData) {
            setError('Giving option (listing) not found.');
            setLoading(false);
            return;
        }
        setListing(listingData);

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
        console.error('GivingPage: Error loading data:', err);
        setError('Unable to load giving page information. Please try again later.');
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

  // --- Handlers ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleProceedToUserDetails = (e) => {
    e.preventDefault();
    if (!formData.giftAmount || formData.giftAmount <= 0) {
      alert('Please enter a valid gift amount.');
      return;
    }
    if (formData.giftType === 'regular' && (!formData.endDate || !formData.recurringFrequency)) {
      alert('Please select a frequency and an ending date for recurring gifts.');
      return;
    }
    setCurrentStep(2);
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    if (!formData.donorName.trim() || !formData.donorEmail.trim()) {
      alert('Please fill in your name and email.');
      return;
    }
    setCurrentStep(3);
  };

  const handleProceedToConfirmation = (e) => {
    e.preventDefault();
    setCurrentStep(4);
  }
  
  const handleBackToStep = (stepNumber) => {
    setCurrentStep(stepNumber);
  };

  const handleSubmitGift = async () => {
    setSubmitting(true);
    try {
      const giftData = {
        donorName: formData.donorName,
        donorEmail: formData.donorEmail,
        amount: formData.giftAmount,
        campaignId: campaign.id,
        campusId: campus.id,
        listingId: listing.id,
        giftType: formData.giftType === 'regular' ? 'Recurring' : 'One-time',
        recurringFrequency: formData.giftType === 'regular' ? formData.recurringFrequency : null,
      };
      await createGift(giftData);
      setSubmitted(true);
    } catch (err) {
      console.error('GivingPage: Error submitting gift:', err);
      alert('Error submitting your gift. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // --- Render Logic ---
  const pageContent = () => {
    if (loading) {
        return <div className="giving-page-layout"><div className="loading-state"><div className="loading-spinner"></div><p>Loading...</p></div></div>;
    }

    if (error) {
        return <div className="giving-page-layout"><div className="error-state"><div className="error-icon">⚠️</div><h2>Unable to Load Page</h2><p>{error}</p></div></div>;
    }

    if (submitted) {
        return (
            <>
                <div className="giving-hero success-hero">
                    <div className="hero-content">
                        <h1>Thank You!</h1>
                        <p>Your gift to {campaign.name} has been processed.</p>
                    </div>
                </div>
                <div className="content-card">
                    <div className="card-content">
                        <div className="success-state">
                        <div className="success-icon">🎉</div>
                        <h2>Gift Successful!</h2>
                        <p>Your gift of <strong>${parseFloat(formData.giftAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}</strong> to <strong>{campaign.name}</strong> has been processed.</p>
                        <div className="success-details">
                            <p><strong>Giving Method:</strong> {listing.name}</p>
                            <p><strong>Campus:</strong> {campus.name}</p>
                            <p>A confirmation email will be sent to <strong>{formData.donorEmail}</strong>.</p>
                        </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="giving-hero">
                <div className="hero-content">
                    <h1 className="campaign-title">{campaign?.name}</h1>
                    <p className="campus-subtitle">{campus ? `${campus.name} via ${listing.name}` : ' '}</p>
                    <h2 className="giving-heading">Make a Gift</h2>
                    
                    <div className="amount-display">
                        <span className="currency">$</span>
                        <input
                            type="number"
                            name="giftAmount"
                            value={formData.giftAmount}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            className="amount-input-large"
                            min="0"
                            step="0.01"
                            disabled={!campus || currentStep > 1}
                        />
                    </div>
                    {formData.giftType === 'regular' && totalRecurringAmount && (
                        <p className="amount-label">
                            Total gift will be <strong>${totalRecurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </p>
                    )}
                </div>
            </div>
            <div className="content-card">
                <div className="card-content">
                {currentStep === 1 && (
                    <form onSubmit={handleProceedToUserDetails}>
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
                           <h4>How would you like to give?</h4>
                           <div className="gift-type-buttons">
                           <button type="button" className={`type-btn ${formData.giftType === 'one-time' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'giftType', value: 'one-time' }})}>Give one time</button>
                           <button type="button" className={`type-btn ${formData.giftType === 'regular' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'giftType', value: 'regular' }})}>Give regularly</button>
                           </div>
                        </div>

                        {formData.giftType === 'regular' && (
                           <>
                           <div className="form-section">
                                 <h4>Frequency</h4>
                                 <div className="gift-type-buttons" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                 <button type="button" className={`type-btn ${formData.recurringFrequency === 'Monthly' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Monthly' }})}>Monthly</button>
                                 <button type="button" className={`type-btn ${formData.recurringFrequency === 'Quarterly' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Quarterly' }})}>Quarterly</button>
                                 <button type="button" className={`type-btn ${formData.recurringFrequency === 'Annually' ? 'active' : ''}`} onClick={() => handleInputChange({ target: { name: 'recurringFrequency', value: 'Annually' }})}>Annually</button>
                                 </div>
                           </div>
                           <div className="form-section">
                                 <div className="date-fields">
                                 <div className="date-field"><label htmlFor="startDate">Starting</label><input type="date" id="startDate" name="startDate" value={formData.startDate} onChange={handleInputChange} required /></div>
                                 <div className="date-field"><label htmlFor="endDate">Ending</label><input type="date" id="endDate" name="endDate" value={formData.endDate} onChange={handleInputChange} required /></div>
                                 </div>
                           </div>
                           </>
                        )}
                        <button type="submit" className="next-btn" style={{background: '#f59e0b'}}>Next</button>
                     </fieldset>
                    </form>
                )}

                {currentStep === 2 && (
                    <form onSubmit={handleProceedToPayment}>
                    <h3 className="form-section-title">Your Information</h3>
                    <div className="form-group">
                        <label htmlFor="donorName">Full Name *</label>
                        <input type="text" id="donorName" name="donorName" value={formData.donorName} onChange={handleInputChange} required placeholder="Enter your full name" />
                        </div>
                        <div className="form-group">
                        <label htmlFor="donorEmail">Email Address *</label>
                        <input type="email" id="donorEmail" name="donorEmail" value={formData.donorEmail} onChange={handleInputChange} required placeholder="Enter your email address" />
                        </div>
                        <div className="step2-actions">
                        <button type="button" className="back-btn" onClick={() => handleBackToStep(1)}>Back</button>
                        <button type="submit" className="next-btn">Next</button>
                        </div>
                    </form>
                )}

                {currentStep === 3 && (
                    <form onSubmit={handleProceedToConfirmation}>
                    <h3 className="form-section-title">Payment Method</h3>
                    <div className="payment-method-card">
                        <div className="payment-card selected">
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
                    <div className="payment-method-card">
                        <button type="button" className="add-payment-method" disabled>
                        <span className="plus-icon">+</span>
                        Add new payment method
                        </button>
                    </div>
                    <div className="step2-actions">
                        <button type="button" className="back-btn" onClick={() => handleBackToStep(2)}>Back</button>
                        <button type="submit" className="next-btn">Next</button>
                    </div>
                    </form>
                )}

                {currentStep === 4 && (
                    <>
                    <h3 className="form-section-title">Confirm Your Gift</h3>
                    {formData.giftType === 'regular' ? (
                        <div className="giving-summary">
                        <div className="summary-item"><span>Contribution ({formData.recurringFrequency}):</span><span>${parseFloat(formData.giftAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-item"><span>Starting on:</span><span>{new Date(formData.startDate).toLocaleDateString('en-US', {day: 'numeric', month: 'long', year: 'numeric'})}</span></div>
                        <div className="summary-item"><span>Ending on:</span><span>{new Date(formData.endDate).toLocaleDateString('en-US', {day: 'numeric', month: 'long', year: 'numeric'})}</span></div>
                        <hr className="summary-hr" />
                        <div className="summary-item"><span>Total Contribution:</span><span>${totalRecurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-item"><span>Total Number of Gifts:</span><span>{calculatePeriods(formData.startDate, formData.endDate, formData.recurringFrequency)} gifts</span></div>
                        </div>
                    ) : (
                        <div className="giving-summary">
                        <div className="summary-item"><span>Amount:</span><span>${parseFloat(formData.giftAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-item"><span>Type:</span><span>One-time gift</span></div>
                        </div>
                    )}
                    <div className="donor-info-summary">
                        <h4>Donor Information</h4>
                        <p><strong>{formData.donorName}</strong></p>
                        <p>{formData.donorEmail}</p>
                    </div>
                    <div className="step2-actions">
                        <button type="button" className="back-btn" onClick={() => handleBackToStep(3)} disabled={submitting}>Back</button>
                        <button type="button" className="next-btn" onClick={handleSubmitGift} disabled={submitting}>{submitting ? 'Processing...' : `Pay $${formData.giftAmount}`}</button>
                    </div>
                    </>
                )}
                </div>
            </div>
        </>
    );
  }

  return (
    <div className="giving-page-layout">
        <header className="giving-page-header">
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
        {pageContent()}
    </div>
  );
}

export default GivingPage;
