import React, { useEffect, useState, createContext, useContext } from 'react';
import { useAuth } from '../auth/AuthContextSupabase';
import { toast } from 'sonner';
const RequestContext = createContext(null);
export const RequestProvider = ({
  children
}) => {
  const [requests, setRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const {
    user,
    getUser,
    getNextApproverInChain,
    isApprover
  } = useAuth();
  useEffect(() => {
    // Load saved requests and audit logs from localStorage
    const savedRequests = localStorage.getItem('requests');
    const savedAuditLogs = localStorage.getItem('auditLogs');
    if (savedRequests) {
      setRequests(JSON.parse(savedRequests));
    }
    if (savedAuditLogs) {
      setAuditLogs(JSON.parse(savedAuditLogs));
    }
  }, []);
  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('requests', JSON.stringify(requests));
  }, [requests]);
  useEffect(() => {
    localStorage.setItem('auditLogs', JSON.stringify(auditLogs));
  }, [auditLogs]);
  const createRequest = async requestData => {
    const newRequest = {
      id: Date.now().toString(),
      ...requestData,
      status: 'pending',
      currentApproverIndex: 0,
      createdAt: new Date().toISOString(),
      createdBy: user.id
    };
    setRequests(prev => [...prev, newRequest]);
    // Add audit log
    addAuditLog({
      action: 'create',
      requestId: newRequest.id,
      userId: user.id,
      timestamp: new Date().toISOString(),
      details: `Request created for ${requestData.supplierName} with amount ${requestData.amount}`
    });
    // Simulate notification to first approver
    const firstApprover = await getUser(requestData.approvers[0]);
    toast.success(`Request created and sent to ${firstApprover?.name || 'Next Approver'} for approval`);
    return newRequest;
  };
  const updateRequestStatus = async (requestId, status, comments = '') => {
    const request = requests?.find(r => r.id === requestId);
    if (!request) {
      return {
        success: false,
        message: 'Request not found'
      };
    }
    // If approving, determine if we need to move to the next approver
    if (status === 'approved') {
      // If this is not the final approver, update the current approver index
      if (request.currentApproverIndex < request.approvers.length - 1) {
        // Move to next approver
        const updatedRequest = {
          ...request,
          currentApproverIndex: request.currentApproverIndex + 1,
          updatedAt: new Date().toISOString(),
          [`approval_${request.currentApproverIndex}_comments`]: comments,
          [`approval_${request.currentApproverIndex}_timestamp`]: new Date().toISOString(),
          status: 'pending' // Still pending for next approver
        };
        setRequests(prev => prev?.map(req => req.id === requestId ? updatedRequest : req));
        // Add audit log
        const currentApprover = await getUser(request?.approvers[request.currentApproverIndex]);
        const nextApprover = await getUser(request.approvers[request.currentApproverIndex + 1]);
        addAuditLog({
          action: 'approved_by_' + currentApprover?.role,
          requestId,
          userId: user.id,
          timestamp: new Date().toISOString(),
          details: `Approved by ${currentApprover?.name}${comments ? ': ' + comments : ''}. Forwarded to ${nextApprover?.name}.`
        });
        toast.success(`Request approved and forwarded to ${nextApprover?.name || 'Next Approver'}`);
        return {
          success: true
        };
      }
      // This is the final approver
      else {
        // Final approval
        const finalStatus = 'approved';
        const updatedRequest = {
          ...request,
          status: finalStatus,
          updatedAt: new Date().toISOString(),
          [`approval_${request.currentApproverIndex}_comments`]: comments,
          [`approval_${request.currentApproverIndex}_timestamp`]: new Date().toISOString()
        };
        setRequests(prev => prev.map(req => req.id === requestId ? updatedRequest : req));
        // Add audit log
        const finalApprover = await getUser(request.approvers[request.currentApproverIndex]);
        addAuditLog({
          action: 'final_approval',
          requestId,
          userId: user.id,
          timestamp: new Date().toISOString(),
          details: `Final approval by ${finalApprover?.name}${comments ? ': ' + comments : ''}. Request is now fully approved.`
        });
        toast.success('Request has received final approval');
        return {
          success: true
        };
      }
    } else {
      // For declined, kiv or other statuses
      const updatedRequest = {
        ...request,
        status,
        updatedAt: new Date().toISOString(),
        comments
      };
      setRequests(prev => prev?.map(req => req.id === requestId ? updatedRequest : req));
      // Add audit log
      addAuditLog({
        action: status,
        requestId,
        userId: user.id,
        timestamp: new Date().toISOString(),
        details: `Request ${status}${comments ? ': ' + comments : ''}`
      });
      return {
        success: true
      };
    }
  };
  const editRequest = (requestId, updatedData) => {
    // Check if request exists and is still pending
    const request = requests?.find(r => r.id === requestId);
    if (!request) {
      return {
        success: false,
        message: 'Request not found'
      };
    }
    if (request.status !== 'pending') {
      return {
        success: false,
        message: 'Only pending requests can be edited'
      };
    }
    // Check if user is the creator
    if (request.createdBy !== user.id) {
      return {
        success: false,
        message: 'You can only edit your own requests'
      };
    }
    // Check if request has already been approved by any approver
    if (request.currentApproverIndex > 0) {
      return {
        success: false,
        message: 'This request has already been partially approved and cannot be edited'
      };
    }
    // Update the request
    setRequests(prev => prev?.map(req => req.id === requestId ? {
      ...req,
      ...updatedData,
      updatedAt: new Date().toISOString()
    } : req));
    // Add audit log
    addAuditLog({
      action: 'edit',
      requestId,
      userId: user.id,
      timestamp: new Date().toISOString(),
      details: 'Request details updated'
    });
    return {
      success: true
    };
  };
  const deleteRequest = requestId => {
    // Check if request exists and is still pending
    const request = requests.find(r => r.id === requestId);
    if (!request) {
      return {
        success: false,
        message: 'Request not found'
      };
    }
    if (request.status !== 'pending') {
      return {
        success: false,
        message: 'Only pending requests can be deleted'
      };
    }
    // Check if user is the creator
    if (request.createdBy !== user.id) {
      return {
        success: false,
        message: 'You can only delete your own requests'
      };
    }
    // Check if request has already been approved by any approver
    if (request.currentApproverIndex > 0) {
      return {
        success: false,
        message: 'This request has already been partially approved and cannot be deleted'
      };
    }
    // Delete the request
    setRequests(prev => prev?.filter(req => req.id !== requestId));
    // Add audit log
    addAuditLog({
      action: 'delete',
      requestId,
      userId: user.id,
      timestamp: new Date().toISOString(),
      details: 'Request deleted'
    });
    return {
      success: true
    };
  };
  const addAuditLog = logEntry => {
    setAuditLogs(prev => [...prev, logEntry]);
  };
  const getRequestById = requestId => {
    return requests?.find(req => req.id === requestId);
  };
  const getRequestsForUser = async (statusFilter = null) => {
    if (user.role === 'initiator') {
      // For initiators, show all their requests
      const initiatorRequests = requests.filter(req => req.createdBy === user.id);
      return statusFilter ? initiatorRequests?.filter(req => req.status === statusFilter) : initiatorRequests;
    } else if (await isApprover(user.id)) {
      // For approvers, show requests that are currently assigned to them
      const approverRequests = requests?.filter(req => {
        // Check if this approver is in the approval chain
        const approverIndex = req.approvers?.indexOf(user.id);
        // Only show if they are the current approver or have already approved
        return approverIndex >= 0 && (approverIndex === req.currentApproverIndex ||
        // Current approver
        req.status === 'pending' && approverIndex < req.currentApproverIndex ||
        // Already approved but still pending
        req.status === 'approved' || req.status === 'declined' || req.status === 'kiv'); // Show completed requests
      });
      return statusFilter ? approverRequests?.filter(req => req.status === statusFilter) : approverRequests;
    } else if (user.role === 'finance') {
      // For finance, show approved requests by default, or filtered by status if specified
      return statusFilter ? requests.filter(req => req.status === statusFilter) : requests.filter(req => req.status === 'approved');
    }
    return [];
  };
  const getAuditLogsForRequest = requestId => {
    return auditLogs?.filter(log => log.requestId === requestId);
  };
  return <RequestContext.Provider value={{
    requests,
    createRequest,
    updateRequestStatus,
    editRequest,
    deleteRequest,
    getRequestById,
    getRequestsForUser,
    getAuditLogsForRequest
  }}>
      {children}
    </RequestContext.Provider>;
};
export const useRequests = () => useContext(RequestContext);