import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import './CampaignDetail.css';
import { fetchCampaignById, fetchCampaignDonors, fetchCampusGoals } from './airtable';

function CampaignDetail({ userRole, userCampuses }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campus');
  const [donors, setDonors] = useState([]);
  
  const [selectedPageCampus, setSelectedPageCampus] = useState('all');
  const [availableCampuses, setAvailableCampuses] = useState([]);
  const [userAccessibleCampusIds, setUserAccessibleCampusIds] = useState([]);
  
  const [campusGoalsData, setCampusGoalsData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadCampaign = async () => {
      try {
        setLoading(true);
        
        const [campaignData, donorData, allCampusGoals] = await Promise.all([
          fetchCampaignById(id),
          fetchCampaignDonors(id),
          fetchCampusGoals()
        ]);
        
        setCampaign(campaignData);
        setDonors(donorData);
        setCampusGoalsData(allCampusGoals);
        
        if (campaignData && campaignData.assignedCampuses) {
          const { fetchCampuses } = await import('./airtable');
          const allCampuses = await fetchCampuses();
          
          let campaignCampuses = allCampuses.filter(campus => 
            campaignData.assignedCampuses.includes(campus.id)
          );
          
          let userAccessibleCampuses = [];
          let accessibleCampusIds = [];
          
          if (userRole === 'org-admin') {
            userAccessibleCampuses = campaignCampuses;
            accessibleCampusIds = campaignCampuses.map(c => c.id);
          } else if (userRole === 'single-campus' || userRole === 'multi-campus') {
            userAccessibleCampuses = campaignCampuses.filter(campus => 
              userCampuses.includes(campus.id)
            );
            accessibleCampusIds = userAccessibleCampuses.map(c => c.id);
          }
          
          setAvailableCampuses(userAccessibleCampuses);
          setUserAccessibleCampusIds(accessibleCampusIds);
        }
        
      } catch (error) {
        console.error('Failed to load campaign:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCampaign();
  }, [id, userRole, userCampuses]);

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  const handleCampusRowClick = (campusId) => {
    setSelectedPageCampus(campusId);
    setActiveTab('members');
  };

  const getOverviewData = () => {
    let financialGoal;

    if (selectedPageCampus === 'all') {
      if (userRole === 'org-admin') {
        financialGoal = campaign?.financialGoal || 0;
      } else {
        const accessibleGoals = campusGoalsData.filter(goal => 
          userAccessibleCampusIds.includes(goal.campusId) && goal.campaignId === campaign?.id
        );
        financialGoal = accessibleGoals.reduce((sum, currentGoal) => sum + currentGoal.goal, 0);
      }
    } else {
      const specificGoal = campusGoalsData.find(
        (goal) => goal.campaignId === campaign?.id && goal.campusId === selectedPageCampus
      );
      financialGoal = specificGoal ? specificGoal.goal : 0;
    }
    
    if (selectedPageCampus === 'all') {
      if (!campaign?.campusBreakdown) {
        return {
          totalRaised: campaign?.totalRaised || 0,
          totalPledged: campaign?.totalPledged || 0,
          financialGoal: financialGoal,
          giftCount: campaign?.giftCount || 0,
          pledgeCount: campaign?.pledgeCount || 0
        };
      }
      
      const accessibleCampusData = campaign.campusBreakdown.filter(campus => 
        userAccessibleCampusIds.includes(campus.campusId)
      );
      
      const aggregated = accessibleCampusData.reduce((acc, campus) => {
        return {
          totalRaised: acc.totalRaised + (campus.raised || 0),
          totalPledged: acc.totalPledged + (campus.pledged || 0),
          giftCount: acc.giftCount + (campus.giftCount || 0),
          pledgeCount: acc.pledgeCount + (campus.pledgeCount || 0)
        };
      }, {
        totalRaised: 0,
        totalPledged: 0,
        giftCount: 0,
        pledgeCount: 0
      });
      
      aggregated.financialGoal = financialGoal;
      return aggregated;
    }
    
    const campusData = campaign.campusBreakdown.find(
      campus => campus.campusId === selectedPageCampus
    );
    
    if (campusData) {
      return {
        totalRaised: campusData.raised || 0,
        totalPledged: campusData.pledged || 0,
        financialGoal: financialGoal,
        giftCount: campusData.giftCount || 0,
        pledgeCount: campusData.pledgeCount || 0
      };
    }
    
    return {
      totalRaised: 0,
      totalPledged: 0,
      financialGoal: financialGoal,
      giftCount: 0,
      pledgeCount: 0
    };
  };

  const getCampusTabData = () => {
    if (!campaign?.assignedCampuses || !availableCampuses.length) return [];
    
    const campusTabData = availableCampuses.map(campus => {
      const existingData = campaign.campusBreakdown?.find(
        breakdown => breakdown.campusId === campus.id
      );
      
      const goalData = campusGoalsData.find(g => 
        g.campusId === campus.id && g.campaignId === campaign?.id
      );
      const campusGoal = goalData ? goalData.goal : 0;

      return {
        campusId: campus.id,
        campusName: campus.name,
        pledged: existingData?.pledged || 0,
        raised: existingData?.raised || 0,
        giftCount: existingData?.giftCount || 0,
        pledgeCount: existingData?.pledgeCount || 0,
        campusGoal: campusGoal
      };
    });
    
    if (selectedPageCampus === 'all') {
      return campusTabData;
    }
    
    return campusTabData.filter(campus => campus.campusId === selectedPageCampus);
  };

  const getMembersTabData = () => {
    let filteredMembers = donors.filter(donor => 
      donor.campusIds.some(campusId => userAccessibleCampusIds.includes(campusId))
    );

    if (selectedPageCampus !== 'all') {
      filteredMembers = filteredMembers.filter(donor => 
        donor.campusIds.includes(selectedPageCampus)
      );
    }

    if (searchQuery.trim() !== '') {
      filteredMembers = filteredMembers.filter(donor =>
        donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        donor.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filteredMembers;
  };

  const calculateDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const days = diffDays % 30;
      return `${months} month${months > 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  };

  const breadcrumbs = [
    { text: 'Campaigns', link: '/org-admin' },
    { text: 'Overview', link: '/org-admin' },
    { text: campaign?.name || 'Loading...' }
  ];

  const overviewData = getOverviewData();
  const campusTabData = getCampusTabData();
  const membersTabData = getMembersTabData();

  const getSelectedCampusName = () => {
    if (selectedPageCampus === 'all') return null;
    const campus = availableCampuses.find(c => c.id === selectedPageCampus);
    return campus?.name || 'Selected Campus';
  };

  const getDropdownLabel = () => {
    if (selectedPageCampus === 'all') {
      if (userRole === 'org-admin') {
        return 'All Campuses';
      } else if (userRole === 'single-campus') {
        return 'All Campuses';
      } else if (userRole === 'multi-campus') {
        return 'All Campuses';
      }
      return 'All Campuses';
    }
    return getSelectedCampusName();
  };

  if (loading) {
    return (
        <Layout breadcrumbs={[{ text: 'Campaigns', link: '/org-admin' }, { text: 'Loading...' }]} userRole={userRole} userCampuses={userCampuses}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Loading campaign details...
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={breadcrumbs} userRole={userRole} userCampuses={userCampuses}>
      <div className="campaign-detail-header">
        <div className="campaign-detail-title">
          <h1>{campaign?.name}</h1>
          <div className="campaign-detail-badges">
            <span className="detail-badge org">
              {campaign?.scope === 'Org' ? 'Org campaign' : 'Campus campaign'}
            </span>
            <span className="detail-badge live">
              {campaign?.status}
            </span>
          </div>
        </div>
        
        <div className="campaign-detail-actions">
          <select 
            className="campus-filter-dropdown"
            value={selectedPageCampus}
            onChange={(e) => setSelectedPageCampus(e.target.value)}
          >
            <option value="all">All Campuses</option>
            {availableCampuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
          
          <button className="detail-action-btn primary">Add a pledge</button>
          <button className="detail-action-btn secondary">Add a gift</button>
        </div>
      </div>

      <div className="campaign-overview">
        <h2 className="overview-title">
          Overview
          {selectedPageCampus !== 'all' && (
            <span className="overview-campus-indicator">
              • {getSelectedCampusName()}
            </span>
          )}
        </h2>
        
        <div className="overview-stats">
          <div className="overview-stat">
            <div className="overview-stat-value">${overviewData.totalRaised?.toLocaleString()}</div>
            <div className="overview-stat-label">Total Given</div>
            <div className="overview-stat-sublabel">Left to goal (given)</div>
          </div>
          
          <div className="overview-stat">
            <div className="overview-stat-value">${overviewData.totalPledged?.toLocaleString()}</div>
            <div className="overview-stat-label">Pledged</div>
            <div className="overview-stat-sublabel">Left to goal (pledged)</div>
          </div>
          
          <div className="overview-stat">
            <div className="overview-stat-value">${overviewData.financialGoal?.toLocaleString()}</div>
            <div className="overview-stat-label">Goal</div>
          </div>
        </div>

       <div className="detail-progress-section">
          <div className="detail-progress-bar">
            <div 
              className="detail-progress-pledged"
              style={{
                width: overviewData.financialGoal > 0 
                  ? `${Math.min((overviewData.totalPledged / overviewData.financialGoal) * 100, 100)}%`
                  : '0%'
              }}
            ></div>
            <div 
              className="detail-progress-raised"
              style={{
                width: overviewData.financialGoal > 0 
                  ? `${Math.min((overviewData.totalRaised / overviewData.financialGoal) * 100, 100)}%`
                  : '0%'
              }}
            ></div>
          </div>
          <div className="detail-progress-labels">
            <span>
              {overviewData.financialGoal > 0 
                ? `${Math.round((overviewData.totalRaised / overviewData.financialGoal) * 100)}%`
                : '0%'
              } Given
            </span>
            <span>
              {overviewData.financialGoal > 0 
                ? `${Math.round((overviewData.totalPledged / overviewData.financialGoal) * 100)}%`
                : '0%'
              } Pledged
            </span>
          </div>
        </div>

        <div className="individual-stats">
          <div className="individual-stat">
            <div className="stat-content">
              <div className="stat-label">Individual gifts</div>
              <div className="stat-value">{overviewData.giftCount?.toLocaleString() || '0'}</div>
            </div>
          </div>

          <div className="individual-stat">
            <div className="stat-content">
              <div className="stat-label">Individual pledges</div>
              <div className="stat-value">{overviewData.pledgeCount?.toLocaleString() || '0'}</div>
            </div>
          </div>

          <div className="individual-stat">
            <div className="stat-content">
              <div className="stat-label">Total Recurring Schedules</div>
              <div className="stat-value">0</div>
            </div>
          </div>
        </div>

        <div className="campaign-timeline">
          {campaign?.startDate && campaign?.endDate ? (
            <span>
              Started {new Date(campaign.startDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })} • 
              Ends {new Date(campaign.endDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })} • 
              Opened for {calculateDuration(campaign.startDate, campaign.endDate)}
            </span>
          ) : (
            <span>Campaign dates not set</span>
          )}
        </div>
      </div>

      <div className="campus-breakdown">
        <div className="breakdown-tabs">
          <button 
            className={`breakdown-tab ${activeTab === 'campus' ? 'active' : ''}`}
            onClick={() => setActiveTab('campus')}
          >
            Campus ({campusTabData.length})
          </button>
          <button 
            className={`breakdown-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({membersTabData.length})
          </button>
        </div>

        <div className="breakdown-header">
          {activeTab === 'members' && (
            <div className="breakdown-search">
              <span className="search-label" style={{ fontSize: '14px', color: '#374151', fontWeight: '500', marginRight: '8px' }}>
                Find member
              </span>
              <input 
                type="text" 
                placeholder="Search members..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
            </div>
          )}
          
          <button className="export-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>

        {activeTab === 'members' && searchQuery && (
          <div style={{ 
            marginBottom: '16px', 
            fontSize: '14px', 
            color: '#6b7280',
            padding: '8px 0',
            borderBottom: '1px solid #f3f4f6'
          }}>
            Showing {membersTabData.length} of {donors.filter(donor => 
              donor.campusIds.some(campusId => userAccessibleCampusIds.includes(campusId)) &&
              (selectedPageCampus === 'all' || donor.campusIds.includes(selectedPageCampus))
            ).length} members matching "{searchQuery}"
          </div>
        )}

        {activeTab === 'campus' ? (
          campusTabData.length > 0 ? (
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Total Pledged</th>
                  <th>Total Raised</th>
                  <th>Campus Goal</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {campusTabData.map((campus) => (
                  <tr key={campus.campusId}>
                    <td>
                      <span 
                        className="campus-name-cell clickable"
                        style={{ cursor: 'pointer', color: '#10b981', fontWeight: '500' }}
                        onClick={() => handleCampusRowClick(campus.campusId)}
                      >
                        {campus.campusName}
                      </span>
                    </td>
                    <td>${campus.pledged?.toLocaleString() || '0'}</td>
                    <td>${campus.raised?.toLocaleString() || '0'}</td>
                    <td>${campus.campusGoal?.toLocaleString() || '0'}</td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar-small">
                          <div 
                            className="progress-fill-small"
                            style={{ 
                              width: campus.campusGoal > 0 
                                ? `${Math.min((campus.raised / campus.campusGoal) * 100, 100)}%`
                                : '0%' 
                            }}
                          ></div>
                        </div>
                        <span className="progress-text-small">
                          {campus.campusGoal > 0
                            ? `${Math.round((campus.raised / campus.campusGoal) * 100)}%`
                            : '0%'
                          }
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              {selectedPageCampus !== 'all' 
                ? `No data available for ${getSelectedCampusName()}`
                : 'No campus data available for this campaign'
              }
            </div>
          )
        ) : (
          <div className="members-content">
            <div className="members-header">
              <h3>
                {selectedPageCampus !== 'all' 
                  ? `${getSelectedCampusName()} Donors` 
                  : 'All Campaign Donors'
                }
              </h3>
              <span className="donor-count">
                {membersTabData.length} donors
                {searchQuery && ` (filtered)`}
              </span>
            </div>
            
            {membersTabData.length > 0 ? (
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email Address</th>
                    <th>Home campus</th>
                    <th>Date pledged</th>
                    <th>Pledged amount</th>
                    <th>Given amount</th>
                    <th>Remaining</th>
                    <th>Progress</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {membersTabData.map((donor) => (
                    <tr key={donor.donorId}>
                      <td>
                        <div className="donor-name">{donor.name}</div>
                      </td>
                      <td>
                        <div className="donor-email">{donor.email}</div>
                      </td>
                      <td>{donor.homeCampus || 'Not specified'}</td>
                      <td>
                        {donor.datePledged 
                          ? new Date(donor.datePledged).toLocaleDateString('en-US', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })
                          : 'No pledge date'
                        }
                      </td>
                      <td>${donor.pledgedAmount?.toLocaleString() || '0'}</td>
                      <td>${donor.givenAmount?.toLocaleString() || '0'}</td>
                      <td>${donor.remaining?.toLocaleString() || '0'}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar-small">
                            <div 
                              className="progress-fill-small"
                              style={{ width: `${Math.min(donor.progress, 100)}%` }}
                            ></div>
                          </div>
                          <span className="progress-text-small">{donor.progress.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        <button className="row-menu-btn">⋯</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                {searchQuery 
                  ? `No members found matching "${searchQuery}"`
                  : selectedPageCampus !== 'all'
                    ? `No donors found for ${getSelectedCampusName()}`
                    : 'No donor data available for this campaign'
                }
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default CampaignDetail;