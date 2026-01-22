import * as React from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { prettyJson } from './utils';
import type { RawEvent } from '../controller/types';

type EventDetailsProps = {
  event: RawEvent | null;
};

type JsonSectionProps = {
  title: string;
  data: unknown;
  isExpanded?: boolean;
};

const JsonSection: React.FC<JsonSectionProps> = ({ title, data, isExpanded = false }) => {
  const [expanded, setExpanded] = React.useState(isExpanded);

  return (
    <ExpandableSection
      toggleText={title}
      onToggle={() => setExpanded(!expanded)}
      isExpanded={expanded}
    >
      <CodeBlock>
        <CodeBlockCode>{prettyJson(data)}</CodeBlockCode>
      </CodeBlock>
    </ExpandableSection>
  );
};

export const EventDetails: React.FC<EventDetailsProps> = ({ event }) => {
  if (!event) {
    return (
      <EmptyState headingLevel="h4" icon={CubesIcon} titleText="No event selected">
        <EmptyStateBody>Select an event from the sidebar to view its details.</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <Card isCompact>
          <CardTitle>Event Summary</CardTitle>
          <CardBody>
            <DescriptionList isCompact isHorizontal>
              <DescriptionListGroup>
                <DescriptionListTerm>Event ID</DescriptionListTerm>
                <DescriptionListDescription>
                  <code>{event.id}</code>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>{event.type}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Timestamp</DescriptionListTerm>
                <DescriptionListDescription>
                  {new Date(event.timestamp).toLocaleString()}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Pathname</DescriptionListTerm>
                <DescriptionListDescription>
                  <code>{event.pathname}</code>
                </DescriptionListDescription>
              </DescriptionListGroup>
              {event.type === 'interaction' && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Event Type</DescriptionListTerm>
                  <DescriptionListDescription>{event.eventType}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
          </CardBody>
        </Card>
      </StackItem>

      {event.type === 'network' ? (
        <>
          <StackItem>
            <Card isCompact>
              <CardTitle>Request</CardTitle>
              <CardBody>
                <DescriptionList isCompact isHorizontal>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Method</DescriptionListTerm>
                    <DescriptionListDescription>{event.request.method}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>URL</DescriptionListTerm>
                    <DescriptionListDescription>
                      <code>{event.request.url}</code>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
                <JsonSection title="Headers" data={event.request.headers} />
                {event.request.body !== undefined ? (
                  <JsonSection title="Body" data={event.request.body} />
                ) : null}
              </CardBody>
            </Card>
          </StackItem>
          {event.response && (
            <StackItem>
              <Card isCompact>
                <CardTitle>Response</CardTitle>
                <CardBody>
                  <DescriptionList isCompact isHorizontal>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Status</DescriptionListTerm>
                      <DescriptionListDescription>
                        {event.response.status}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                  <JsonSection title="Headers" data={event.response.headers} />
                  {event.response.body !== undefined ? (
                    <JsonSection title="Body" data={event.response.body} />
                  ) : null}
                </CardBody>
              </Card>
            </StackItem>
          )}
        </>
      ) : (
        <>
          <StackItem>
            <Card isCompact>
              <CardTitle>Accessibility Path</CardTitle>
              <CardBody>
                <DescriptionList isCompact isHorizontal>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Role</DescriptionListTerm>
                    <DescriptionListDescription>{event.a11y.role}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Name</DescriptionListTerm>
                    <DescriptionListDescription>
                      {event.a11y.name || <Content component="small">n/a</Content>}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  {event.a11y.landmark && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Landmark</DescriptionListTerm>
                      <DescriptionListDescription>{event.a11y.landmark}</DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {event.a11y.region && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Region</DescriptionListTerm>
                      <DescriptionListDescription>{event.a11y.region}</DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {event.a11y.nearestHeading && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Nearest Heading</DescriptionListTerm>
                      <DescriptionListDescription>
                        {event.a11y.nearestHeading}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  <DescriptionListGroup>
                    <DescriptionListTerm>Semantic Path</DescriptionListTerm>
                    <DescriptionListDescription>
                      <code>{event.a11y.semanticPath}</code>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>

          <StackItem>
            <Card isCompact>
              <CardTitle>Element Attributes</CardTitle>
              <CardBody>
                {Object.keys(event.attributes).length > 0 ? (
                  <DescriptionList isCompact isHorizontal>
                    {Object.entries(event.attributes).map(([key, value]) => (
                      <DescriptionListGroup key={key}>
                        <DescriptionListTerm>{key}</DescriptionListTerm>
                        <DescriptionListDescription>
                          <code>{value}</code>
                        </DescriptionListDescription>
                      </DescriptionListGroup>
                    ))}
                  </DescriptionList>
                ) : (
                  <Content component="small">No attributes captured</Content>
                )}
              </CardBody>
            </Card>
          </StackItem>

          <StackItem>
            <Card isCompact>
              <CardTitle>Context Values</CardTitle>
              <CardBody>
                {Object.keys(event.context).length > 0 ? (
                  <CodeBlock>
                    <CodeBlockCode>{prettyJson(event.context)}</CodeBlockCode>
                  </CodeBlock>
                ) : (
                  <Content component="small">No context values captured</Content>
                )}
              </CardBody>
            </Card>
          </StackItem>

          <StackItem>
            <Card isCompact>
              <CardTitle>URL Parameters</CardTitle>
              <CardBody>
                {Object.keys(event.urlParams).length > 0 ? (
                  <DescriptionList isCompact isHorizontal>
                    {Object.entries(event.urlParams).map(([key, value]) => (
                      <DescriptionListGroup key={key}>
                        <DescriptionListTerm>{key}</DescriptionListTerm>
                        <DescriptionListDescription>
                          <code>{value}</code>
                        </DescriptionListDescription>
                      </DescriptionListGroup>
                    ))}
                  </DescriptionList>
                ) : (
                  <Content component="small">No URL parameters</Content>
                )}
              </CardBody>
            </Card>
          </StackItem>

          {event.baselineMatch && (
            <StackItem>
              <Card isCompact>
                <CardTitle>Baseline Match</CardTitle>
                <CardBody>
                  <DescriptionList isCompact isHorizontal>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Pattern</DescriptionListTerm>
                      <DescriptionListDescription>
                        {event.baselineMatch.pattern}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Stable ID</DescriptionListTerm>
                      <DescriptionListDescription>
                        <code>{event.baselineMatch.stableId}</code>
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>Event Name</DescriptionListTerm>
                      <DescriptionListDescription>
                        {event.baselineMatch.eventName}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                </CardBody>
              </Card>
            </StackItem>
          )}

          {event.capturedEvents && event.capturedEvents.length > 0 && (
            <StackItem>
              <Card isCompact>
                <CardTitle>Captured Events</CardTitle>
                <CardBody>
                  <DescriptionList isCompact isHorizontal>
                    {event.capturedEvents.map((capture) => (
                      <DescriptionListGroup key={capture.id}>
                        <DescriptionListTerm>Event</DescriptionListTerm>
                        <DescriptionListDescription>
                          <code>{capture.eventName}</code>
                        </DescriptionListDescription>
                      </DescriptionListGroup>
                    ))}
                  </DescriptionList>
                </CardBody>
              </Card>
            </StackItem>
          )}
        </>
      )}
    </Stack>
  );
};
