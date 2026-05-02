export function seo({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return [
    { title },
    ...(description
      ? [
          {
            name: 'description',
            content: description,
          },
        ]
      : []),
  ]
}
