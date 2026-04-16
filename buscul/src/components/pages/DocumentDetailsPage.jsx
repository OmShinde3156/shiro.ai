import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';

const DocumentDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (user && user.id) {
        try {
          const response = await fetch(`${API_BASE_URL}/documents/${user.id}/${id}`);
          if (response.ok) {
            const data = await response.json();
            setDocument(data);
          } else {
            setError('Failed to fetch document details');
          }
        } catch (err) {
          setError('An error occurred while fetching the document');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDocument();
  }, [id, user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!document) {
    return <div>Document not found</div>;
  }

  return (
    <div>
      <h1>{document.filename}</h1>
      <p>Content: {document.content}</p>
      {/* Add more details as needed */}
    </div>
  );
};

export default DocumentDetailsPage;

