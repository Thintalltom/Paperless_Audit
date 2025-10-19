import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContextSupabase';
import { supabase } from '../supabaseClient';
import { PlusIcon, CheckCircleIcon, XCircleIcon, ClockIcon, EyeIcon, FilterIcon } from 'lucide-react';
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState(user?.role === 'approver' ? 'pending' : null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch requests from database
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        let query = supabase.from('Request_table').select('*');
        
        // Apply status filter if selected
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching requests:', error);
        } else {
          setRequests(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [statusFilter]);
  const getStatusBadge = status => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
            Pending
          </span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
            Approved
          </span>;
      case 'declined':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
            Declined
          </span>;
      case 'kiv':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
            Keep in View
          </span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>;
    }
  };
  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  // Get the title based on role and filter
  const getDashboardTitle = () => {
    if (user.role === 'initiator') {
      return 'My Requests';
    } else if (user.role === 'approver') {
      if (statusFilter) {
        return statusFilter === 'pending' ? 'Pending Approvals' : statusFilter === 'approved' ? 'Approved Requests' : statusFilter === 'declined' ? 'Declined Requests' : 'Requests On Hold';
      }
      return 'All Requests';
    } else if (user.role === 'finance') {
      return statusFilter === 'approved' ? 'Payment Processing' : 'All Requests';
    }
    return 'Dashboard';
  };
  return <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {getDashboardTitle()}
        </h1>
        <div className="flex items-center gap-4">
          {/* Status filter dropdown for approvers and finance */}
          {(user?.role === 'approver' || user?.role === 'finance' || user?.role === 'initiator') && <div className="flex items-center">
              <FilterIcon className="h-4 w-4 text-gray-500 mr-2" />
              <select value={statusFilter || ''} onChange={e => setStatusFilter(e.target.value || null)} className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
                <option value="kiv">Keep in View</option>
              </select>
            </div>}
          {/* Create button for initiators */}
          {user.role === 'initiator' && <button onClick={() => navigate('/create-request')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center text-sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              New Request
            </button>}
        </div>
      </div>
      {requests?.length === 0 ? <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">
            {statusFilter ? `No ${statusFilter} requests found.` : user.role === 'approver' ? 'No requests to display.' : user.role === 'finance' ? 'No approved requests to process.' : 'You have not created any requests yet.'}
          </p>
          {user.role === 'initiator' && <button onClick={() => navigate('/create-request')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center mx-auto text-sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create your first request
            </button>}
        </div> : <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Loading requests...
                  </td>
                </tr>
              ) : (
                requests?.map(request => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{request.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${parseFloat(request.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button onClick={() => navigate(`/requests/${request.id}`)} className="text-blue-600 hover:text-blue-800 flex items-center">
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View
                        </button>
                        {user?.role === 'approver' && request.status === 'pending' && (
                          <>
                            <button onClick={() => navigate(`/requests/${request.id}`)} className="text-green-600 hover:text-green-800 flex items-center">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              Approve
                            </button>
                            <button onClick={() => navigate(`/requests/${request.id}`)} className="text-red-600 hover:text-red-800 flex items-center">
                              <XCircleIcon className="h-4 w-4 mr-1" />
                              Decline
                            </button>
                            <button onClick={() => navigate(`/requests/${request.id}`)} className="text-blue-600 hover:text-blue-800 flex items-center">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              KIV
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>}
    </div>;
};
export default Dashboard;