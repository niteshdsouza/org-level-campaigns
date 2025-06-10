// PledgePage.jsx - Donor-facing pledge landing page (redesigned)
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { extractPledgeParams, validatePledgeIds, formatParamErrors } from './urlUtils';
import { fetchCampaignById, fetchCampuses } from './airtable';
import './PledgePage.css';

function PledgePage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [campus, setCampus] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    donorName: '',
    donorEmail: '',
    pledgeAmount: '',
    pledgeType: 'one-time', // 'one-time' or 'regular'
    startDate: new Date().toISOString().split('T')[0], // Today's date
    endDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // TODO: Create pledge record in Airtable
      console.log('PledgePage: Submitting pledge:', {
        campaign: campaign.id,
        campus: campus.id,
        donor: formData
      });

      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSubmitted(true);
      console.log('PledgePage: Pledge submitted successfully');

    } catch (err) {
      console.error('PledgePage: Error submitting pledge:', err);
      alert('Error submitting pledge. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        <div className="pledge-hero">
          <div className="success-state">
            <div className="success-icon">✅</div>
            <h2>Thank You for Your Pledge!</h2>
            <p>Your {formData.pledgeType === 'regular' ? 'recurring' : 'one-time'} pledge of <strong>${formData.pledgeAmount}</strong> to <strong>{campaign.name}</strong> at <strong>{campus.name}</strong> has been recorded.</p>
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
            />
          </div>
          <p className="amount-label">Your total</p>
        </div>
      </div>

      {/* Content Card */}
      <div className="content-card">
        <div className="card-content">
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
          <form onSubmit={handleSubmit} className="pledge-form-new">
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

            {/* Donor Info Fields */}
            <div className="form-section">
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
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="next-btn"
              disabled={submitting || !formData.pledgeAmount || !formData.donorName || !formData.donorEmail}
            >
              {submitting ? 'Processing...' : 'Next'}
            </button>
          </form>

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