import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { supabase } from '../supabaseClient';
import { ArrowLeftIcon, PaperclipIcon } from 'lucide-react';
import { notify } from 'reapop';
const CreateRequest = () => {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();

  const getApprovalChain = async () => {
    const APPROVAL_CHAIN = [
      'branch-approver', 'dd_operations', 'Admin', 'b_auditor', 'dd_operations',  'ho_auditor', 
      'account_unit', 'dd_finance', 'ged'
    ];
    
    const { data, error } = await supabase
      .from('Approval_chain_table')
      .select('*')
      .in('role', APPROVAL_CHAIN);

    if (error) return [];

    // If user email exists, filter branch-approver by domain
    if (user?.username) {
      const userDomain = user.username.split('@')[1];
    
      const filtered = data.filter(approver => {
        if (approver.role === 'branch-approver') {
          const approverDomain = approver.username?.split('@')[1];
          return approverDomain === userDomain;
        }
        return true;
      });
      
      return filtered.sort((a, b) => 
        APPROVAL_CHAIN.indexOf(a.role) - APPROVAL_CHAIN.indexOf(b.role)
      );
    }

    return data.sort((a, b) => 
      APPROVAL_CHAIN.indexOf(a.role) - APPROVAL_CHAIN.indexOf(b.role)
    );
  };
  const navigate = useNavigate();
  // Get the full approval chain
  const [approvalChain, setApprovalChain] = useState([]);
  
  useEffect(() => {
    const fetchApprovalChain = async () => {
      // console.log('Fetching approval chain...');
      const chain = await getApprovalChain();
      //  console.log('Approval chain result:', chain);
      setApprovalChain(chain);
    };
    fetchApprovalChain();
  }, [user?.email]);
  
  // console.log('Current approval chain state:', approvalChain);
  const [formData, setFormData] = useState({
    initiatorName: '',
    supplierName: '',
    amount: '',
    description: '',
    attachments: []
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    
    for (const file of files) {
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 2MB.`);
        return;
      }
    }
    
    const fileObjects = await Promise.all(
      files.map(async (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64Content = reader.result.split(',')[1]; // Remove data:type;base64, prefix
            
            resolve({
              name: file.name,
              size: file.size,
              type: file.type,
              content: base64Content,
              url: URL.createObjectURL(file)
            });
          };
          reader.readAsDataURL(file);
        });
      })
    );
    
    setFormData({
      ...formData,
      attachments: [...formData.attachments, ...fileObjects]
    });
  };
  const removeAttachment = index => {
    const newAttachments = [...formData.attachments];
    newAttachments.splice(index, 1);
    setFormData({
      ...formData,
      attachments: newAttachments
    });
  };
  const validateForm = () => {
    const newErrors = {};
    if (!formData.initiatorName.trim()) {
      newErrors.initiatorName = 'Initiator name is required';
    }
    if (!formData.supplierName.trim()) {
      newErrors.supplierName = 'Supplier name is required';
    }
    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async e => {
    // console.log('=== Form submit triggered!');
    e.preventDefault();
    // console.log('=== Form data before validation:', formData);
    
    const isValid = validateForm();
    // console.log('=== Validation result:', isValid);
    // console.log('=== Validation errors:', errors);
    
    if (!isValid) {
      // console.log('=== Validation failed, not submitting');
      return;
    }
    
    // console.log('=== Validation passed, starting submission...');
    setIsSubmitting(true);
    
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
      
      // console.log('=== Submitting form data:', formData);
      // console.log('=== User ID:', user?.id);
      
      // Convert attachments to JSON string for database storage
      const attachmentsString = formData.attachments.length > 0 
        ? JSON.stringify(formData.attachments.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            content: file?.content
          })))
        : null;

      // Get the assigned branch-approver for this request
      const chain = await getApprovalChain();
      const branchApprover = chain.find(approver => approver.role === 'branch-approver');

      // Request data with approval system initialization
      const requestData = {
        initiator_name: formData.initiatorName,
        supplier_name: formData.supplierName,
        amount: parseFloat(formData.amount),
        description: formData.description,
        attachment: attachmentsString,
        status: 'pending',
        created_by: user?.id,
        current_approval_level: 0, // Start at level 0 (first approver)
        approval_status: {}, // Track each level's status
        approval_history: [], // Track all approval actions
        account_name: user?.username,
        branch_approver_id: branchApprover?.id // Store assigned branch-approver ID
      };
      
      // console.log('=== Request data to insert:', requestData);

      const { data, error } = await supabase
        .from('Request_table')
        .insert(requestData)
        .select(); // Add select to get the inserted data bathe ck

      // console.log('=== Insert result - data:', data);
      // console.log('=== Insert result - error:', error);
      
      if (error) {
        // console.error('Error creating request:', error);
        dispatch(notify({
          title: 'Error',
          message: `Failed to create request: ${error.message}`,
          status: 'error',
          dismissible: true,
          dismissAfter: 5000
        }));
        setIsSubmitting(false);
        return;
      }

      // console.log('=== Request created successfully, clearing form and navigating...');
      
      // Show success notification
      dispatch(notify({
        title: 'Success',
        message: 'Request created successfully!',
        status: 'success',
        dismissible: true,
        dismissAfter: 3000
      }));
      
      // Clear form data after successful submission
      setFormData({
        initiatorName: '',
        supplierName: '',
        amount: '',
        description: '',
        attachments: []
      });
      setErrors({});
      
      navigate('/');
    } catch (error) {
      // console.error('Error creating request:', error);
      return error
    } finally {
      // Ensure isSubmitting is always reset
      // console.log('=== Resetting isSubmitting state');
      setIsSubmitting(false);
    }
  };
  return <div>
      <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Dashboard
      </button>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            Create New Expense Request
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="initiatorName" className="block text-sm font-medium text-gray-700 mb-1">
                Initiator Name*
              </label>
              <input type="text" id="initiatorName" name="initiatorName" value={formData.initiatorName} onChange={handleChange} className={`block w-full px-3 py-2 border ${errors.initiatorName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm`} placeholder="Enter your name" />
              {errors?.initiatorName && <p className="mt-1 text-sm text-red-600">
                  {errors?.initiatorName}
                </p>}
            </div>
            <div>
              <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name*
              </label>
              <input type="text" id="supplierName" name="supplierName" value={formData.supplierName} onChange={handleChange} className={`block w-full px-3 py-2 border ${errors.supplierName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm`} />
              {errors.supplierName && <p className="mt-1 text-sm text-red-600">
                  {errors.supplierName}
                </p>}
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount*
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₦</span>
                </div>
                <input type="number" step="0.01" id="amount" name="amount" value={formData.amount} onChange={handleChange} className={`block w-full pl-7 pr-12 py-2 border ${errors.amount ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm`} placeholder="0.00" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">Naira</span>
                </div>
              </div>
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description*
              </label>
              <textarea id="description" name="description" rows={3} value={formData.description} onChange={handleChange} className={`block w-full px-3 py-2 border ${errors.description ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm`} />
              {errors.description && <p className="mt-1 text-sm text-red-600">
                  {errors.description}
                </p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachments
              </label>
              <div className="flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <PaperclipIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                  DOCX, JPG, up to 2MB
                  </p>
                </div>
              </div>
              {formData.attachments.length > 0 && <ul className="mt-4 border rounded-md divide-y">
                  {formData.attachments.map((file, index) => <li key={index} className="px-4 py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <PaperclipIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <button type="button" onClick={() => removeAttachment(index)} className="text-red-600 hover:text-red-800">
                        Remove
                      </button>
                    </li>)}
                </ul>}
            </div>
            <div className="pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Approval Chain
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                This request will be sent through the following approval chain:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <ol className="relative border-l border-gray-300 ml-3 space-y-6">
                  {approvalChain.map((approver, index) => <li key={index} className="mb-4 ml-6">
                      <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
                        {index + 1}
                      </span>
                      <h3 className="flex items-center mb-1 text-sm font-semibold text-gray-900">
                        {approver.username}
                      </h3>
                      <p className="text-xs text-gray-500">{approver.role}</p>
                    </li>)}
                </ol>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button type="button" onClick={() => navigate('/')} className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              // onClick={() => console.log('=== Submit button clicked!')}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isSubmitting ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>;
};
export default CreateRequest;