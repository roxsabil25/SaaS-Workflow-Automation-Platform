import React from 'react';
import { Card, Alert, Tag, Spin } from 'antd';
import { HighlightOutlined } from '@ant-design/icons';
import UnifiedTextEditor from '../../index';

const TemplateContentTab = ({ 
  parsedTemplate, 
  contentHtml, 
  loading,
  comments, 
  suggestions, 
  references,
  logo,
  headerHTML,
  footerHTML,
  logoText,
  logoTextRight,
  setHeaderHTML,
  setFooterHTML,
  setLogoText,
  setLogoTextRight,
  setLogo,
  currentUser, 
  socketUpdateKey, 
  pagesContainerRef,
  setContentHtml,
  handleCommentsChange,
  handleSuggestionsChange,
  handleReferencesChange,
  emitCommentAdd,
  emitCommentUpdate,
  emitCommentDelete,
  emitSuggestionAdd,
  emitSuggestionUpdate,
  emitSuggestionDelete,

  lastTypingTimeRef,
  userRole, // ADDED
  isDocument = false
}) => {
  const memoizedInitialContent = React.useMemo(() => ({
    content: contentHtml || '',
    headerHTML: headerHTML || '',
    footerHTML: footerHTML || '',
    logo: logo || null,
    logoText: logoText || '',
    logoTextRight: logoTextRight || ''
  }), [contentHtml, headerHTML, footerHTML, logo, logoText, logoTextRight]);

  return (
    <Card style={{ }} bordered={false}>
      {(parsedTemplate.status === 'pending_review' || parsedTemplate.status === 'reviewed') && (
        <Card.Meta // fallback or standard card wrapper
        />
      )}
      {/* Rest of JSX remains unchanged, but let's make sure alert/elements render correctly */}
      {(parsedTemplate.status === 'pending_review' || parsedTemplate.status === 'reviewed') && (
        <Alert
          message="Template Content"
          description={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                View and comment on the template content. Select text to add comments.
              </span>
              <div>
                <Tag icon={<HighlightOutlined />} color="processing">
                  Select text to add comments
                </Tag>
                {comments.length > 0 && (
                  <Tag color="success">
                    {comments.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0)} total interactions
                  </Tag>
                )}
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <div className="template-content-preview">
        <div className="template-editor-wrapper" style={{ display: 'flex', flexDirection: 'column', position: 'relative', minHeight: '800px' }}>
          {(() => {
            if (!contentHtml && parsedTemplate && loading) {
               return (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16 }}>Loading content...</div>
                </div>
               );
            } else {
              return (
                <UnifiedTextEditor
                  mode="preview"
                  user={currentUser}
                  currentUser={currentUser}
                  userRole={userRole} // Pass userRole
                  initialContent={memoizedInitialContent}
                  logo={logo}
                  setLogo={setLogo}
                  comments={comments}
                  suggestions={suggestions}
                  references={references}
                  templateId={isDocument ? parsedTemplate.template_id : (parsedTemplate.id || parsedTemplate.template_id)}
                  documentId={isDocument ? (parsedTemplate.document_id || parsedTemplate.id) : undefined}
                  socketEnabled={true}
                  showTOC={parsedTemplate.includeTableOfContents}
                  pagesContainerRef={pagesContainerRef}
                  isApprovalState={parsedTemplate?.status === 'pending_approval' || parsedTemplate?.status === 'approved'}
                  isDocument={isDocument}
                  onContentChange={(changeData) => {
                    // This is still needed for debounced changes
                    if (lastTypingTimeRef) {
                      lastTypingTimeRef.current = Date.now();
                    }
                    const htmlContent = changeData?.content || '';
                    setContentHtml(htmlContent);
                    if (changeData?.headerHTML !== undefined) {
                      setHeaderHTML(changeData.headerHTML || '');
                    }
                    if (changeData?.footerHTML !== undefined) {
                      setFooterHTML(changeData.footerHTML || '');
                    }
                    if (changeData?.logoText !== undefined) {
                      setLogoText(changeData.logoText || '');
                    } else if (changeData?.logo?.text !== undefined) {
                      setLogoText(changeData.logo.text || '');
                    }
                    
                    if (changeData?.logoTextRight !== undefined) {
                      setLogoTextRight(changeData.logoTextRight || '');
                    } else if (changeData?.logo?.textRight !== undefined) {
                      setLogoTextRight(changeData.logo.textRight || '');
                    }
                  }}
                  onTyping={() => {
                    // Update typing time IMMEDIATELY on any user interaction
                    if (lastTypingTimeRef) {
                      lastTypingTimeRef.current = Date.now();
                    }
                  }}
                  onCommentsChange={handleCommentsChange}
                  onSuggestionsChange={handleSuggestionsChange}
                  onReferencesChange={handleReferencesChange}
                  onCommentAdd={emitCommentAdd}
                  onCommentUpdate={emitCommentUpdate}
                  onCommentDelete={emitCommentDelete}
                  onSuggestionAdd={emitSuggestionAdd}
                  onSuggestionUpdate={emitSuggestionUpdate}
                  onSuggestionDelete={emitSuggestionDelete}
                />
              );
            }
          })()}
        </div>
      </div>
    </Card>
  );
};

TemplateContentTab.displayName = 'TemplateContentTab';

export default TemplateContentTab;
