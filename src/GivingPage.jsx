// GivingPage.jsx - Donor-facing giving landing page
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { extractGivingParams, validateGivingIds, formatParamErrors } from './urlUtils';
import { fetchCampaignById, fetchCampuses, fetchListings } from './airtable';
import './GivingPage.css';

function GivingPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [campus, setCampus] = useState(null);
  const [listing, setListing] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    donorName: '',
    donorEmail: '',
    giftAmount: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true);
        setError('');

        // Extract and validate URL parameters
        const { campaignId, campusId, listingId, errors, isValid } = extractGivingParams(location.search);
        
        if (!isValid) {
          setError(formatParamErrors(errors));
          setLoading(false);
          return;
        }

        // Validate ID formats
        const { isValid: idsValid, errors: idErrors } = validateGivingIds(campaignId, campusId, listingId);
        if (!idsValid) {
          setError(formatParamErrors(idErrors));
          setLoading(false);
          return;
        }

        console.log('GivingPage: Loading data for campaign:', campaignId, 'campus:', campusId, 'listing:', listingId);

        // Fetch campaign, campus, and listing data
        const [campaignData, campusesData, listingsData] = await Promise.all([
          fetchCampaignById(campaignId),
          fetchCampuses(),
          fetchListings()
        ]);

        // Find the specific campus and listing
        const campusData = campusesData.find(c => c.id === campusId);
        const listingData = listingsData.find(l => l.id === listingId);
        
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

        if (!listingData) {
          setError('Giving option not found. Please contact the organization for a valid donation link.');
          setLoading(false);
          return;
        }

        // Verify that this campus is assigned to the campaign
        if (!campaignData.assignedCampuses.includes(campusId)) {
          setError('This campus is not participating in this campaign. Please contact the organization.');
          setLoading(false);
          return;
        }

        // Verify that this listing is associated with the campus
        if (!listingData.campusIds.includes(campusId)) {
          setError('This giving option is not available for this campus. Please contact the organization.');
          setLoading(false);
          return;
        }

        setCampaign(campaignData);
        setCampus(campusData);
        setListing(listingData);
        console.log('GivingPage: Data loaded successfully', { campaignData, campusData, listingData });

      } catch (err) {
        console.error('GivingPage: Error loading data:', err);
        setError('Unable to load campaign information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [location.search]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // TODO: Create gift record in Airtable
      console.log('GivingPage: Submitting gift:', {
        campaign: campaign.id,
        campus: campus.id,
        listing: listing.id,
        donor: formData
      });

      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSubmitted(true);
      console.log('GivingPage: Gift submitted successfully');

    } catch (err) {
      console.error('GivingPage: Error submitting gift:', err);
      alert('Error submitting gift. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="giving-page">
        <div className="giving-container">
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
      <div className="giving-page">
        <div className="giving-container">
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
      <div className="giving-page">
        <div className="giving-container">
          <div className="success-state">
            <div className="success-icon">🎉</div>
            <h2>Thank You for Your Gift!</h2>
            <p>Your gift of <strong>${formData.giftAmount}</strong> to <strong>{campaign.name}</strong> at <strong>{campus.name}</strong> has been processed.</p>
            <p>You will receive a confirmation email at <strong>{formData.donorEmail}</strong> with your receipt.</p>
            <div className="success-details">
              <p><strong>Giving Method:</strong> {listing.name}</p>
              <p><strong>Campaign:</strong> {campaign.name}</p>
              <p><strong>Campus:</strong> {campus.name}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="giving-page">
      <div className="giving-container">
        {/* Campaign Header */}
        <div className="campaign-header">
          <h1>{campaign.name}</h1>
          <p className="campus-name">Supporting {campus.name}</p>
          <p className="giving-method">via {listing.name}</p>
          {campaign.description && (
            <p className="campaign-description">{campaign.description}</p>
          )}
        </div>

        {/* Campaign Progress */}
        <div className="campaign-progress">
          <div className="progress-stats">
            <div className="stat">
              <span className="stat-value">${campaign.totalRaised?.toLocaleString() || '0'}</span>
              <span className="stat-label">Raised</span>
            </div>
            <div className="stat">
              <span className="stat-value">${campaign.totalPledged?.toLocaleString() || '0'}</span>
              <span className="stat-label">Pledged</span>
            </div>
            <div className="stat">
              <span className="stat-value">${campaign.financialGoal?.toLocaleString() || '0'}</span>
              <span className="stat-label">Goal</span>
            </div>
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{
                width: campaign.financialGoal > 0 
                  ? `${Math.min((campaign.totalRaised / campaign.financialGoal) * 100, 100)}%`
                  : '0%'
              }}
            ></div>
          </div>
          
          <p className="progress-text">
            {campaign.financialGoal > 0 
              ? `${Math.round((campaign.totalRaised / campaign.financialGoal) * 100)}% of goal reached`
              : 'Help us reach our goal!'
            }
          </p>
        </div>

        {/* Gift Form */}
        <div className="gift-form-section">
          <h2>Make Your Gift</h2>
          <div className="giving-method-info">
            <div className="method-badge">{listing.name}</div>
            <p>You're giving through {listing.name} to support {campus.name}</p>
          </div>
          
          <form onSubmit={handleSubmit} className="gift-form">
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

            <div className="form-group">
              <label htmlFor="giftAmount">Gift Amount *</label>
              <div className="amount-input">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  id="giftAmount"
                  name="giftAmount"
                  value={formData.giftAmount}
                  onChange={handleInputChange}
                  required
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Give Now'}
            </button>
          </form>

          <p className="form-footer">
            By submitting this gift, you authorize the immediate processing of your donation to support {campaign.name} at {campus.name}.
          </p>
        </div>
      </div>
    </div>
  );
}

export default GivingPage;