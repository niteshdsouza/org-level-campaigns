// ShareModal.jsx
import { useState, useEffect } from 'react';
import { fetchCampuses, fetchListings, fetchOrgFundListings } from './airtable';
import './ShareModal.css';

function ShareModal({ campaign, userRole, userCampuses, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [listings, setListings] = useState([]);
  const [orgListing, setOrgListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [allCampuses, allListings, orgListings] = await Promise.all([
          fetchCampuses(),
          fetchListings(),
          fetchOrgFundListings()
        ]);

        let relevantCampuses = allCampuses.filter(campus => 
          campaign.assignedCampuses.includes(campus.id)
        );

        if (userRole === 'single-campus' || userRole === 'multi-campus') {
          relevantCampuses = relevantCampuses.filter(campus => 
            userCampuses.includes(campus.id)
          );
        }

        setCampuses(relevantCampuses);
        setListings(allListings);

        if (campaign.donationDestination === 'Org Fund' && campaign.orgFundListing) {
          const orgListingId = Array.isArray(campaign.orgFundListing) ? campaign.orgFundListing[0] : campaign.orgFundListing;
          const orgListingRecord = orgListings.find(listing => listing.id === orgListingId);
          setOrgListing(orgListingRecord);
        }

      } catch (error) {
        console.error('ShareModal: Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [campaign, userRole, userCampuses]);

  // --- Link Generation Functions ---

  const generatePledgeLink = (campusId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/pledge?campaign=${campaign.id}&campus=${campusId}`;
  };

  const generateGivingLink = (campusId, listingId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/give?campaign=${campaign.id}&campus=${campusId}&listing=${listingId}`;
  };

  const generateOrgPledgeLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/pledge?campaign=${campaign.id}`;
  };
  
  const generateOrgGivingLink = () => {
      if (campaign.donationDestination === 'Org Fund' && orgListing) {
          const baseUrl = window.location.origin;
          return `${baseUrl}/give?campaign=${campaign.id}&listing=${orgListing.id}`;
      }
      return null;
  };

  const getListingsForCampus = (campusId) => {
    if (campaign.donationDestination === 'Org Fund') {
      return orgListing ? [orgListing] : [];
    } else {
      return listings.filter(listing => 
        listing.campusIds.includes(campusId)
      );
    }
  };

  // UPDATED: This function now opens the link in a new tab instead of copying it.
  const handleLinkClick = (url) => {
    if (!url) {
        alert("This link is not available for the campaign's current configuration.");
        return;
    }
    // Open the generated URL in a new browser tab
    window.open(url, '_blank');
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const filteredCampuses = campuses.filter(campus =>
    campus.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const orgGivingLink = generateOrgGivingLink();


  if (loading) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="share-modal-container">
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            Loading campaign sharing options...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="share-modal-container">
        <div className="share-modal-header">
          <h3 className="share-modal-title">Pledging & Giving Links</h3>
          <button className="share-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="share-modal-search">
          <input
            type="text"
            placeholder="Search campuses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="share-search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="share-modal-content">
          {userRole === 'org-admin' && (
            <div className="campus-share-section org-section-modifier">
              <h4 className="campus-share-name">Org Links</h4>
              <div className="share-links-container">
                 <div className="share-link-section">
                    <div className="share-section-header">
                        <span className="share-section-label">PLEDGE LINK</span>
                    </div>
                    <button
                        className="share-link-button pledge-link"
                        onClick={() => handleLinkClick(generateOrgPledgeLink())}
                    >
                        <span className="link-icon">🔗</span>
                        Open Org Pledge Link
                    </button>
                 </div>
                 <div className="share-link-section">
                    <div className="share-section-header">
                        <span className="share-section-label">GIVING LINK</span>
                    </div>
                     <button
                        className={`share-link-button giving-link ${!orgGivingLink ? 'disabled' : ''}`}
                        onClick={() => handleLinkClick(orgGivingLink)}
                        disabled={!orgGivingLink}
                        title={!orgGivingLink ? "Only available for campaigns with an 'Org Fund' destination" : `Open ${orgListing?.name || ''} link`}
                    >
                        <span className="link-icon">🔗</span>
                        Open Org Giving Link
                    </button>
                 </div>
              </div>
            </div>
          )}

          {filteredCampuses.length === 0 ? (
            <div className="no-campuses-message">
              {searchQuery ? 
                'No campuses found matching your search.' : 
                'No campuses available for this campaign or your role.'
              }
            </div>
          ) : (
            filteredCampuses.map((campus) => {
              const campusListings = getListingsForCampus(campus.id);
              
              return (
                <div key={campus.id} className="campus-share-section">
                  <h4 className="campus-share-name">{campus.name}</h4>
                  
                  <div className="share-links-container">
                    <div className="share-link-section">
                      <div className="share-section-header">
                        <span className="share-section-label">PLEDGE LINK</span>
                      </div>
                      <button
                        className="share-link-button pledge-link"
                        onClick={() => handleLinkClick(generatePledgeLink(campus.id))}
                      >
                        <span className="link-icon">🔗</span>
                        Open Pledge Entry link
                      </button>
                    </div>

                    <div className="share-link-section">
                      <div className="share-section-header">
                        <span className="share-section-label">GIVING LINKS</span>
                      </div>
                      {campusListings.length === 0 ? (
                        <div className="no-listings-message">
                          No giving links available for this campus
                        </div>
                      ) : (
                        campusListings.map((listing) => (
                          <button
                            key={listing.id}
                            className="share-link-button giving-link"
                            onClick={() => handleLinkClick(generateGivingLink(campus.id, listing.id))}
                          >
                            <span className="link-icon">🔗</span>
                            Open {listing.name} link
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
