import React, { useState, useEffect } from "react";
import { SinglePostCard } from "./SinglePostCard";

export function SinglePostView({
  postId,
  apiBaseUrl,
  authToken,
  currentUserId,
  canLike,
}) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadPost() {
      if (!apiBaseUrl || !postId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const headers = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }
        const response = await fetch(`${apiBaseUrl}/posts/${encodeURIComponent(postId)}`, {
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to load post: ${response.status}`);
        }
        const postData = await response.json();
        if (!isCancelled) {
          setPost(postData);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load post");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadPost();

    return () => {
      isCancelled = true;
    };
  }, [postId, apiBaseUrl, authToken]);

  if (loading) {
    return <div className="single-post-loading">Loading post...</div>;
  }

  if (error || !post) {
    return (
      <div className="single-post-error">
        {error || "Post not found."}
      </div>
    );
  }

  return (
    <div className="single-post-container">
      <SinglePostCard
        post={post}
        apiBaseUrl={apiBaseUrl}
        authToken={authToken}
        currentUserId={currentUserId}
        canLike={canLike}
      />
    </div>
  );
}
