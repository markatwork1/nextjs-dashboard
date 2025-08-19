type Props = {
  params: { id: string };
};

export default async function Page({ params }: Props) {
  const { id } = params;
  // Fetch invoice data here using id, e.g.:
  // const invoice = await fetchInvoiceById(id);
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Edit Invoice</h1>
      <p>Invoice ID: {id}</p>
      {/* Render invoice edit form here */}
    </main>
  );
}
