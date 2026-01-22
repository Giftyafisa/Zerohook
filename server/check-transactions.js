require('dotenv').config();
const mongoose = require('mongoose');

async function checkTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Transaction = mongoose.connection.collection('transactions');
    
    // Find all deposit/wallet_topup transactions
    const txs = await Transaction.find({ 
      type: { $in: ['deposit', 'wallet_topup'] } 
    }).sort({ created_at: -1 }).limit(10).toArray();
    
    console.log('\n=== Recent deposits/wallet_topup transactions ===');
    console.log('Total found:', txs.length);
    
    txs.forEach((t, i) => {
      console.log(`\n${i+1}. Reference: ${t.reference}`);
      console.log(`   Type: ${t.type}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Amount: ${t.amount} ${t.currency}`);
      console.log(`   User ID: ${t.user_id}`);
      console.log(`   Created: ${t.created_at}`);
    });
    
    // Also check user balance calculation
    const userId = '696eac7d6369e7a294d6f51e'; // sammy_afisa
    const userObjId = new mongoose.Types.ObjectId(userId);
    
    const depositResult = await Transaction.aggregate([
      { 
        $match: { 
          user_id: userObjId, 
          type: { $in: ['deposit', 'wallet_topup'] }, 
          status: { $in: ['completed', 'confirmed'] } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    console.log('\n=== Wallet Balance for sammy_afisa ===');
    console.log('Completed deposits total:', depositResult[0]?.total || 0);
    
    await mongoose.disconnect();
    console.log('\nDisconnected');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTransactions();
