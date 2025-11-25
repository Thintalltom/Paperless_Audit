import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { supabase } from '../supabaseClient';
import { CheckCircleIcon, XCircleIcon, ClockIcon, PaperclipIcon, UserIcon, CalendarIcon, ArrowLeftIcon, DownloadIcon, EditIcon, TrashIcon, AlertTriangleIcon, CheckIcon, XIcon, Clock9Icon } from 'lucide-react';
const RequestDetails = () => {
  const { requestId } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  
  const getApprovalChain = async (requestData) => {
    const APPROVAL_CHAIN = [
      'branch-approver', 'ho_admin', 'ho_auditor', 
      'account_unit', 'dd_operations', 'dd_finance', 'ged'
    ];
    
    const { data, error } = await supabase
      .from('Approval_chain_table')
      .select('*')
      .in('role', APPROVAL_CHAIN);

    if (error) return [];

    // If request has branch_approver_id, get that specific approver
    if (requestData?.branch_approver_id) {
      const branchApprover = data.find(approver => 
        approver.role === 'branch-approver' && approver.id === requestData.branch_approver_id
      );
      
      const otherApprovers = data.filter(approver => approver.role !== 'branch-approver');
      const allApprovers = branchApprover ? [branchApprover, ...otherApprovers] : otherApprovers;
      
      return allApprovers.sort((a, b) => 
        APPROVAL_CHAIN.indexOf(a.role) - APPROVAL_CHAIN.indexOf(b.role)
      );
    }

    return data.sort((a, b) => 
      APPROVAL_CHAIN.indexOf(a.role) - APPROVAL_CHAIN.indexOf(b.role)
    );
  };
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [auditTrail, setAuditTrail] = useState([]);
  const [approvalChain, setApprovalChain] = useState([]);

  // Fetch approval chain and request details
  useEffect(() => {
    const fetchData = async () => {
      if (!requestId) return;
      
      try {
        // Fetch request details first
        console.log('Fetching request with ID:', requestId);
        const { data, error } = await supabase
          .from('Request_table')
          .select('*')
          .eq('id', requestId);

        if (error) {
          console.error('Error fetching request:', error);
        } else if (data && data.length > 0) {
          const requestData = data[0];
          setRequest(requestData);
          
          // Fetch approval chain for this specific request
          const chain = await getApprovalChain(requestData);
          setApprovalChain(chain);
          
          if (data.length > 1) {
            console.warn(`Found ${data.length} records with ID ${requestId}, using the first one`);
          }
        } else {
          console.log('No request found with ID:', requestId);
          setRequest(null);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  // Generate audit trail for 9-level approval system
  const generateAuditTrail = (requestData, chain) => {
    const trail = [
      {
        id: 1,
        level: 'Initiator',
        user: requestData.initiator_name,
        action: 'Created',
        status: 'completed',
        timestamp: requestData.created_at,
        comments: 'Request created'
      }
    ];

    const currentLevel = requestData.current_approval_level || 0;
    const approvalStatus = requestData.approval_status || {};
    const approvalHistory = requestData.approval_history || [];

    // Add approval chain levels
    chain.forEach((approver, index) => {
      const levelStatus = approvalStatus[index];
      const isCurrentLevel = index === currentLevel && requestData.status === 'pending';
      const isCompleted = levelStatus && levelStatus.status;
      const isWaiting = index > currentLevel;
      
      let action, status, timestamp, comments;
      
      if (isCompleted) {
        action = levelStatus.status === 'approved' ? 'Approved' : 
                levelStatus.status === 'declined' ? 'Declined' : 'Kept in View';
        status = 'completed';
        timestamp = levelStatus.timestamp;
        comments = levelStatus.comments || `Request ${levelStatus.status}`;
      } else if (isCurrentLevel) {
        action = 'Pending Review';
        status = 'pending';
        timestamp = null;
        comments = 'Awaiting approval';
      } else {
        action = 'Awaiting Previous Approval';
        status = 'waiting';
        timestamp = null;
        comments = 'Waiting for previous level approval';
      }
      
      trail.push({
        id: index + 2,
        level: approver.role.replace('_', ' ').toUpperCase(),
        user: approver.name || approver.username,
        action,
        status,
        timestamp,
        comments
      });
    });

    setAuditTrail(trail);
  };

  // Generate audit trail when request or approval chain changes
  useEffect(() => {
    if (request && approvalChain.length > 0) {
      generateAuditTrail(request, approvalChain);
    }
  }, [request, approvalChain]);

  if (loading) {
    return <div className="text-center py-8">Loading request details...</div>;
  }
  if (!request) {
    return <div className="text-center py-8">Request not found</div>;
  }

  // Initialize edit form data if not already set
  if (isEditing && Object.keys(editFormData).length === 0) {
    setEditFormData({
      supplierName: request?.supplier_name,
      amount: request?.amount,
      description: request?.description
    });
  }

  // Check if current user can approve at current level
  const currentLevel = request?.current_approval_level || 0;
  const currentApprover = approvalChain[currentLevel];
  const canApprove = user && currentApprover && user.id === currentApprover.id && request.status === 'pending';
  const canEditOrDelete = user?.id === request?.created_by && request.status === 'pending';
  const handleAction = async (action) => {
    try {
      // Check session validity
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        navigate('/login');
        return;
      }
      
      const currentLevel = request?.current_approval_level || 0;
      const approvalStatus = { ...request?.approval_status };
      const approvalHistory = [...(request?.approval_history || [])];
      
      // Record the approval action
      approvalStatus[currentLevel] = {
        status: action,
        approver_id: user.id,
        timestamp: new Date().toISOString(),
        comments: comments
      };
      
      approvalHistory.push({
        level: currentLevel,
        approver_id: user?.id,
        action,
        comments,
        timestamp: new Date().toISOString()
      });
      
      let newStatus = request?.status;
      let newLevel = currentLevel;
      
      if (action === 'declined') {
        newStatus = 'declined';
      } else if (action === 'approved') {
        // Move to next level if not at the end
        if (currentLevel < approvalChain.length - 1) {
          newLevel = currentLevel + 1;
        } else {
          // Final approval - request is fully approved
          newStatus = 'approved';
        }
      }
      // For 'kiv', status remains pending but action is recorded
      
      const updateData = {
        approval_status: approvalStatus,
        approval_history: approvalHistory,
        current_approval_level: newLevel,
        status: newStatus
      };
      
      // Update database
      const { error } = await supabase
        .from('Request_table')
        .update(updateData)
        .eq('id', requestId);
        
      // Also insert into approval_action table
      // await supabase
      //   .from('approval_action')
      //   .insert({
      //     request_id: requestId,
      //     approver_id: user.id,
      //     approval_level: currentLevel,
      //     action,
      //     comments
      //   });

      if (error) {
        console.error('Error updating request:', error);
        alert('Failed to update request');
      } else {
        // Update local state
        setRequest(prev => ({ ...prev, ...updateData }));
        alert(`Request ${action} successfully`);
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to update request');
    }
    setComments('');
  };
  const handleEdit = async (e) => {
    e.preventDefault();
    // Validate form
    if (!editFormData.supplierName || !editFormData.amount || !editFormData.description) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      // Check session validity
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        navigate('/login');
        return;
      }
      
      const { error } = await supabase
        .from('Request_table')
        .update({
          supplier_name: editFormData.supplierName,
          amount: parseFloat(editFormData.amount),
          description: editFormData.description
        })
        .eq('id', requestId);
        
      if (error) {
        console.error('Error updating request:', error);
        alert('Failed to update request');
      } else {
        // Update local state
        setRequest(prev => ({
          ...prev,
          supplier_name: editFormData.supplierName,
          amount: parseFloat(editFormData.amount),
          description: editFormData.description
        }));
        setIsEditing(false);
        alert('Request updated successfully');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to update request');
    }
  };
  const handleDelete = async () => {
    try {
      // Check session validity
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        navigate('/login');
        return;
      }
      
      const { error } = await supabase
        .from('Request_table')
        .delete()
        .eq('id', requestId);
        
      if (error) {
        console.error('Error deleting request:', error);
        alert('Failed to delete request');
      } else {
        alert('Request deleted successfully');
        // Force navigation with state to trigger refresh
        navigate('/', { replace: true, state: { refresh: Date.now() } });
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to delete request');
    }
    setShowDeleteConfirm(false);
  };
  const handleEditChange = e => {
    const {
      name,
      value
    } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleDownload = attachment => {
    try {
      // Decode base64 content to binary
      const binaryString = atob(attachment.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob with actual file content
      const blob = new Blob([bytes], { type: attachment.type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    }
  };
  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
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
  return <div>
      <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Dashboard
      </button>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Request #{request.id}
          </h1>
          <div className="flex items-center gap-3">
            {getStatusBadge(request.status)}
            {canEditOrDelete && <div className="flex space-x-2">
                <button onClick={() => setIsEditing(!isEditing)} className="text-blue-600 hover:text-blue-800 flex items-center">
                  <EditIcon className="h-4 w-4 mr-1" />
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="text-red-600 hover:text-red-800 flex items-center">
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Delete
                </button>
              </div>}
          </div>
        </div>
        {showDeleteConfirm && <div className="p-4 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangleIcon className="h-5 w-5" />
              <p className="font-medium">
                Are you sure you want to delete this request?
              </p>
            </div>
            <div className="mt-3 flex justify-end space-x-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white rounded-md text-sm">
                Delete
              </button>
            </div>
          </div>}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Request Details
              </h2>
              {isEditing ? <form onSubmit={handleEdit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Supplier Name*
                      </label>
                      <input type="text" name="supplierName" required className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={editFormData.supplierName} onChange={handleEditChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount*
                      </label>
                      <input type="number" step="0.01" name="amount" required className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={editFormData.amount} onChange={handleEditChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description*
                      </label>
                      <textarea name="description" rows={3} required className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={editFormData.description} onChange={handleEditChange} />
                    </div>
                    <div className="flex justify-end space-x-3 pt-3">
                      <button type="button" onClick={() => setIsEditing(false)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Cancel
                      </button>
                      <button type="submit" className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form> : <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Supplier Name
                    </label>
                    <div className="mt-1 text-sm text-gray-900">
                      {request.supplier_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Initiator Name
                    </label>
                    <div className="mt-1 text-sm text-gray-900">
                      {request.initiator_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Amount
                    </label>
                    <div className="mt-1 text-sm text-gray-900">
                      ${parseFloat(request.amount).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Description
                    </label>
                    <div className="mt-1 text-sm text-gray-900">
                      {request.description}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Created on: {formatDate(request.created_at)}
                  </div>
                </div>}
              {request.attachment && <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900">
                    Attachments
                  </h3>
                  <div className="mt-2 space-y-2">
                    {(() => {
                      try {
                        const attachments = JSON.parse(request.attachment);
                        return attachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <div className="flex items-center">
                              <PaperclipIcon className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • {file.type}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDownload(file)} 
                              className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                            >
                              <DownloadIcon className="h-4 w-4 mr-1" />
                              Download
                            </button>
                          </div>
                        ));
                      } catch (e) {
                        return (
                          <div className="p-3 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-600">{request.attachment}</p>
                          </div>
                        );
                      }
                    })()
                    }
                  </div>
                </div>}
              
              {/* Simplified version - you can enhance this later */}
              {false && <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900">
                    Attachments
                  </h3>
                  <ul className="mt-2 border rounded-md divide-y">
                    {request.attachments.map((file, index) => <li key={index} className="px-4 py-3 flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <PaperclipIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button type="button" onClick={() => handleDownload(file)} className="text-blue-600 hover:text-blue-800 flex items-center">
                          <DownloadIcon className="h-4 w-4 mr-1" />
                          Download
                        </button>
                      </li>)}
                  </ul>
                </div>}
              {/* Audit Trail */}
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Approval Audit Trail
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-4">
                    {auditTrail.map((entry, index) => (
                      <div key={entry.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {entry.status === 'completed' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : entry.status === 'pending' ? (
                            <ClockIcon className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <Clock9Icon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">
                              {entry.level}
                            </p>
                            {entry.timestamp && (
                              <p className="text-xs text-gray-500">
                                {formatDate(entry.timestamp)}
                              </p>
                            )}
                          </div>
                          <div className="mt-1">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">{entry.user}</span> - {entry.action}
                            </p>
                            {entry.comments && (
                              <p className="text-xs text-gray-500 mt-1">
                                {entry.comments}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Request Information
              </h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Request ID:</span>
                    <span className="text-sm text-gray-900">#{request.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className="text-sm text-gray-900">{request.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Created:</span>
                    <span className="text-sm text-gray-900">{formatDate(request.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {canApprove && <div className="mt-8 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Approval Action
              </h3>
              <div className="mb-4">
                <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-1">
                  Comments (Optional)
                </label>
                <textarea id="comments" rows={3} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={comments} onChange={e => setComments(e.target.value)} />
              </div>
              <div className="flex space-x-3">
                <button onClick={() => handleAction('approved')} className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center">
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Approve
                </button>
                <button onClick={() => handleAction('kiv')} className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Keep in View
                </button>
                <button onClick={() => handleAction('declined')} className="bg-red-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center">
                  <XCircleIcon className="h-4 w-4 mr-2" />
                  Decline
                </button>
              </div>
            </div>}
        </div>
      </div>
    </div>;
};
export default RequestDetails;